// Entity factories. Everything returned here is plain JSON-serializable data.

import { rand, randInt, pick, weighted, chance } from './rng.js';
import { SEVERITY, CLIENTS, TECHS, PROSPECTS, TICKETS } from './constants.js';
import { TICKET_TYPES, TICKET_TITLES, COMPANY_NAMES, TECH_NAMES, PERSONALITIES } from './content.js';
import { getStat, hasFlag } from './modifiers.js';

function pickPersonality(state) {
  return weighted(state, Object.entries(PERSONALITIES).map(([id, p]) => [id, p.weight]));
}

export function makeClient(state, tier, opts = {}) {
  const id = `c${state.counters.clientSeq++}`;
  const [lo, hi] = CLIENTS.SIZE[tier];
  return {
    id,
    name: opts.name ?? pick(state, COMPANY_NAMES) + (state.counters.clientSeq > COMPANY_NAMES.length ? ` #${state.counters.clientSeq}` : ''),
    tier,
    size: opts.size ?? randInt(state, lo, hi),
    patience: opts.patience ?? CLIENTS.START_PATIENCE,
    personality: opts.personality ?? pickPersonality(state),
    signedTick: state.tick,
    breachedThisWeek: false,
  };
}

export function makeTicket(state, client, opts = {}) {
  const id = `t${state.counters.ticketSeq++}`;
  const p = PERSONALITIES[client.personality];

  let type = opts.type ?? pick(state, TICKET_TYPES);
  // Security incidents mostly come from events, not the ambient stream.
  if (type === 'security_incident' && !opts.type && !chance(state, 0.35)) type = pick(state, TICKET_TYPES.filter((t) => t !== 'security_incident'));

  let actual = opts.actualSeverity ?? weighted(state, SEVERITY.SPAWN_WEIGHTS);
  if (type === 'security_incident' && hasFlag(state, 'incident_downgrade')) actual = Math.min(4, actual + 1);

  // Claimed severity: clients exaggerate (the core joke) or, rarely, bury a P1.
  let claimed = actual;
  if (opts.claimedSeverity != null) {
    claimed = opts.claimedSeverity;
  } else if (chance(state, TICKETS.MISLABEL_UP * p.mislabelUpMult)) {
    claimed = 1;
  } else if (actual === 1 && chance(state, TICKETS.MISLABEL_DOWN)) {
    claimed = 4;
  }

  const [eLo, eHi] = SEVERITY.EFFORT[actual];
  let effort = eLo + rand(state) * (eHi - eLo);
  if (hasFlag(state, `instant_type:${type}`)) effort = 0.5;

  // SLA clock keyed to CLAIMED severity (the client is watching their own
  // label) scaled by tier; monitoring gives a head start before it begins.
  const lead = getStat(state, 'monitoring_lead', 0);
  const slaTicks = Math.round(SEVERITY.SLA_TICKS[claimed] * CLIENTS.SLA_MULT[client.tier]);

  return {
    id,
    clientId: client.id,
    type,
    title: opts.title ?? pick(state, TICKET_TITLES[type]),
    severity: claimed,          // what the client filed
    actualSeverity: actual,     // hidden until triaged
    triaged: false,
    effort: Math.round(effort * 10) / 10,
    progress: 0,
    createdTick: state.tick,
    slaDeadline: state.tick + lead + slaTicks,
    breached: false,
    assignedTo: null,
  };
}

export function makeTech(state, role) {
  const id = `e${state.counters.techSeq++}`;
  const def = TECHS.ROLES[role];
  const [lo, hi] = def.skillRange;
  const skills = {};
  for (const t of TICKET_TYPES) skills[t] = randInt(state, lo, hi);
  // Everyone has one thing they're weirdly good at.
  if (role !== 'dispatcher') skills[pick(state, TICKET_TYPES)] = Math.min(5, hi + 1);
  return {
    id,
    name: pick(state, TECH_NAMES) + (state.counters.techSeq > TECH_NAMES.length ? ` ${state.counters.techSeq}` : ''),
    role,
    skills,
    salaryWeek: def.salaryWeek,
    capacity: def.capacity,
    morale: TECHS.START_MORALE,
    hiredTick: state.tick,
  };
}

export function makePlayer(state) {
  const skills = {};
  for (const t of TICKET_TYPES) skills[t] = TECHS.PLAYER.skillRange[0];
  return {
    id: 'you',
    name: 'You',
    role: 'owner',
    skills,
    salesSkill: TECHS.PLAYER.salesSkill,
    salaryWeek: TECHS.PLAYER.salaryWeek,
    capacity: TECHS.PLAYER.capacity,
    morale: TECHS.START_MORALE,
    hiredTick: 0,
  };
}

export function makeProspect(state, tier) {
  const id = `p${state.counters.prospectSeq++}`;
  const [lo, hi] = PROSPECTS.SALES_EFFORT;
  return {
    id,
    name: pick(state, COMPANY_NAMES),
    tier,
    size: randInt(state, ...CLIENTS.SIZE[tier]),
    personality: pickPersonality(state),
    salesEffort: randInt(state, lo, hi),
    salesProgress: 0,
    working: false,
    appearedTick: state.tick,
    expiresTick: state.tick + PROSPECTS.EXPIRE_TICKS,
  };
}
