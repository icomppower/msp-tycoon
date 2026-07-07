// Ticket lifecycle: spawn → work → resolve/botch/abandon, plus SLA breaches.

import { chance, pick } from './rng.js';
import { SEVERITY, TICKETS, CLIENTS, ECONOMY, TECHS, todMult, isBusinessHours, moraleFactor } from './constants.js';
import { TICKET_TYPES, TICKET_TITLES, PERSONALITIES } from './content.js';
import { getStat, hasFlag } from './modifiers.js';
import { makeTicket } from './entities.js';
import { applyPatience } from './clients.js';
import { log, clock } from './state.js';

export function spawnTickets(state) {
  const { day, hour } = clock(state);
  const globalMult = getStat(state, 'spawn_mult', 1);
  let tod = todMult(day, hour);
  if (day === 4 && hour === TICKETS.FRIDAY_SPIKE_HOUR) tod *= TICKETS.FRIDAY_SPIKE_MULT; // Friday 4:55pm, hardcoded per GDD

  for (const client of state.clients) {
    const p = PERSONALITIES[client.personality];
    const pMult = p.spawnMult ? p.spawnMult(day, hour) : 1;
    const rate =
      client.size * TICKETS.BASE_SPAWN_PER_SEAT *
      TICKETS.TIER_SPAWN_FACTOR[client.tier] * tod * pMult * globalMult;
    if (!chance(state, Math.min(0.95, rate))) continue;

    // Pick type here so security-tree modifiers can filter it.
    let type = pick(state, TICKET_TYPES);
    if (type === 'security_incident') {
      const keep = 0.35 * getStat(state, 'incident_spawn_mult', 1) * getStat(state, 'self_inflict_mult', 1);
      if (!chance(state, keep)) type = pick(state, TICKET_TYPES.filter((t) => t !== 'security_incident'));
    }

    const ticket = makeTicket(state, client, { type });

    // The DIYer already "fixed" it. It is now worse.
    if (p.selfInflict && chance(state, p.selfInflict * getStat(state, 'self_inflict_mult', 1))) {
      ticket.actualSeverity = Math.max(1, ticket.actualSeverity - 1);
      ticket.effort = Math.round(ticket.effort * 1.5 * 10) / 10;
      ticket.title = `tried to fix it themselves: ${ticket.title}`;
    }

    // Auto-remediation eats actual-P4s at the door (bills at half rate).
    if (ticket.actualSeverity === 4 && chance(state, getStat(state, 'auto_resolve_p4', 0))) {
      payoutFor(state, client, ticket, ECONOMY.AUTO_RESOLVE_PAYOUT);
      state.counters.resolved++;
      state.counters.autoResolved++;
      log(state, `auto-remediated: "${ticket.title}" (${client.name})`, 'auto');
      continue;
    }

    state.tickets.push(ticket);
    state.counters.spawned++;
  }
}

function payoutFor(state, client, ticket, mult = 1) {
  if (client.tier !== 'breakfix') return 0; // managed tickets are covered by MRR
  const pay = Math.round((ECONOMY.BREAKFIX_BASE + ECONOMY.BREAKFIX_PER_EFFORT * ticket.effort) * mult);
  state.cash += pay;
  state.counters.breakfixRevenue += pay;
  return pay;
}

export function effectiveSkill(state, tech, type) {
  let s = tech.skills[type] ?? 1;
  if (tech.role !== 'owner') {
    const rampTicks = TECHS.RAMP_WEEKS * 168 * getStat(state, 'ramp_mult', 1);
    if (state.tick - tech.hiredTick < rampTicks) s = Math.max(1, s - 1);
  }
  return s;
}

export function effectiveCapacity(state, tech) {
  if (tech.role === 'dispatcher') return 0;
  let cap = tech.capacity + getStat(state, 'capacity_add', 0);
  // Working a sales prospect occupies one of the player's slots.
  if (tech.id === 'you' && state.prospects.some((p) => p.working)) cap -= 1;
  return Math.max(0, cap);
}

export function progressTickets(state) {
  const resolved = [];
  for (const tech of state.techs) {
    const assigned = state.tickets.filter((t) => t.assignedTo === tech.id);
    const cap = effectiveCapacity(state, tech);
    const working = assigned.slice(0, cap); // over-capacity assignments queue, unworked

    if (working.length === 0) {
      tech.morale = Math.min(100, tech.morale + TECHS.MORALE_IDLE_RECOVERY);
    } else {
      let drain = TECHS.MORALE_WORK_DRAIN * working.length;
      if (working.some((t) => t.actualSeverity === 1)) drain += TECHS.MORALE_P1_DRAIN;
      if (working.length >= cap && cap > 0) drain += TECHS.MORALE_MAXED_DRAIN;
      tech.morale = Math.max(0, tech.morale - drain);
    }

    for (const ticket of working) {
      ticket.progress += effectiveSkill(state, tech, ticket.type) * moraleFactor(tech.morale);
      if (ticket.progress >= ticket.effort) resolved.push({ ticket, tech });
    }
  }

  for (const { ticket, tech } of resolved) closeTicket(state, ticket, tech);
}

function closeTicket(state, ticket, tech) {
  state.tickets = state.tickets.filter((t) => t.id !== ticket.id);
  const client = state.clients.find((c) => c.id === ticket.clientId);
  if (!client) return; // client churned while ticket was open
  const p = PERSONALITIES[client.personality];

  // Botch: skill gap vs the ACTUAL severity. Botched work comes back angrier.
  const gap = SEVERITY.REQ_SKILL[ticket.actualSeverity] - effectiveSkill(state, tech, ticket.type);
  if (gap > 0 && chance(state, TICKETS.BOTCH_BASE * gap)) {
    const worse = makeTicket(state, client, {
      type: ticket.type,
      actualSeverity: Math.max(1, ticket.actualSeverity - 1),
      claimedSeverity: Math.max(1, ticket.severity - 1),
      title: `aftermath: ${ticket.title}`,
    });
    state.tickets.push(worse);
    state.counters.botched++;
    applyPatience(state, client, -3 * p.patienceDecayMult);
    log(state, `${tech.name} botched "${ticket.title}" — it came back worse (${client.name})`, 'bad');
    return;
  }

  const pay = payoutFor(state, client, ticket);
  const slaSpan = ticket.slaDeadline - ticket.createdTick;
  const fast = state.tick - ticket.createdTick < slaSpan * TICKETS.FAST_RESOLVE_FRAC;
  applyPatience(state, client, fast ? TICKETS.GOODWILL_FAST : TICKETS.GOODWILL_ANY);
  state.counters.resolved++;
  log(state, `resolved: "${ticket.title}" (${client.name})${pay ? ` +$${pay}` : ''}`, 'good');
}

export function checkSLAs(state) {
  const { day, hour } = clock(state);
  const offHours = !isBusinessHours(day, hour);
  const abandoned = [];

  for (const ticket of state.tickets) {
    const client = state.clients.find((c) => c.id === ticket.clientId);
    if (!client) { abandoned.push(ticket); continue; }
    const p = PERSONALITIES[client.personality];

    if (!ticket.breached && state.tick > ticket.slaDeadline) {
      ticket.breached = true;
      state.counters.breached++;
      client.breachedThisWeek = true;
      const covered = offHours && hasFlag(state, 'after_hours_cover');
      if (!covered) {
        applyPatience(state, client, -SEVERITY.BREACH_PENALTY[ticket.severity] * p.patienceDecayMult);
        if (ticket.severity === 1) state.reputation = Math.max(0, state.reputation - 1.5);
      }
      log(state, `SLA BREACH (P${ticket.severity}): "${ticket.title}" (${client.name})${covered ? ' — after-hours desk absorbed it' : ''}`, 'bad');
    }

    const slaSpan = ticket.slaDeadline - ticket.createdTick;
    if (state.tick > ticket.createdTick + slaSpan * TICKETS.ABANDON_MULT) {
      abandoned.push(ticket);
      applyPatience(state, client, -TICKETS.ABANDON_PENALTY * p.patienceDecayMult);
      log(state, `client gave up waiting: "${ticket.title}" (${client.name})`, 'bad');
    }
  }

  if (abandoned.length) {
    const ids = new Set(abandoned.map((t) => t.id));
    state.tickets = state.tickets.filter((t) => !ids.has(t.id));
    state.counters.abandoned += abandoned.length;
  }
}
