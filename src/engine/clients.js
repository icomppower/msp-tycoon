// Client patience/churn and the prospect pipeline.

import { chance } from './rng.js';
import { CLIENTS, PROSPECTS, REPUTATION, TIME } from './constants.js';
import { PERSONALITIES } from './content.js';
import { hasFlag } from './modifiers.js';
import { makeProspect, makeClient } from './entities.js';
import { moraleFactor } from './constants.js';
import { log } from './state.js';

export function applyPatience(state, client, delta) {
  client.patience = Math.max(0, Math.min(CLIENTS.PATIENCE_MAX, client.patience + delta));
}

// churn_prob = sigmoid((midpoint - patience) / k), rolled weekly under the
// threshold. midpoint 22 / k 6 → ~0.21 at patience 30, ~0.88 at patience 10.
export function churnProb(patience) {
  return 1 / (1 + Math.exp(-((CLIENTS.CHURN_MIDPOINT - patience) / CLIENTS.CHURN_K)));
}

export function weeklyClientPass(state) {
  const gone = [];
  for (const client of state.clients) {
    if (!client.breachedThisWeek) {
      applyPatience(state, client, CLIENTS.WEEKLY_RECOVERY);
      state.reputation = Math.min(100, state.reputation + REPUTATION.HAPPY_CLIENT_WEEKLY);
    }
    client.breachedThisWeek = false;

    const ageWeeks = (state.tick - client.signedTick) / TIME.TICKS_PER_WEEK;
    if (client.patience < CLIENTS.CHURN_THRESHOLD && ageWeeks >= CLIENTS.CHURN_GRACE_WEEKS) {
      if (chance(state, churnProb(client.patience))) gone.push(client);
    }
  }
  for (const client of gone) churnClient(state, client, 'walked');
}

export function churnClient(state, client, how) {
  state.clients = state.clients.filter((c) => c.id !== client.id);
  state.tickets = state.tickets.filter((t) => t.clientId !== client.id);
  state.counters.churned++;
  state.reputation = Math.max(0, state.reputation - REPUTATION.CHURN_HIT);
  log(state, `CHURN: ${client.name} ${how === 'poached' ? 'signed with Synergy IT Partners' : 'terminated the agreement'} (−$${Math.round(client.size * CLIENTS.SEAT_PRICE_MONTH * CLIENTS.MRR_MULT[client.tier])}/mo MRR)`, 'bad');
}

// ─── Prospects ────────────────────────────────────────────────

export function prospectTier(state) {
  const rep = state.reputation;
  if (rep >= REPUTATION.PROSPECT_MSEC_MIN && hasFlag(state, 'vcio') && chance(state, 0.35)) return 'managed_security';
  if (rep >= REPUTATION.PROSPECT_MANAGED_MIN && chance(state, 0.55)) return 'managed';
  return 'breakfix';
}

export function dailyProspectPass(state) {
  state.prospects = state.prospects.filter((p) => {
    if (state.tick <= p.expiresTick) return true;
    log(state, `prospect went cold: ${p.name} (they "went another direction")`, 'info');
    return false;
  });
  if (state.prospects.length >= PROSPECTS.PIPELINE_CAP) return;
  const p = PROSPECTS.DAILY_SPAWN_BASE + state.reputation / PROSPECTS.DAILY_SPAWN_REP_DIV;
  if (chance(state, p)) {
    const prospect = makeProspect(state, prospectTier(state));
    state.prospects.push(prospect);
    log(state, `new lead: ${prospect.name} (${prospect.size} seats, ${prospect.tier.replace('_', '+')})`, 'good');
  }
}

// Sales runs through the player: a working prospect occupies one player
// capacity slot (see effectiveCapacity) and advances by sales skill per tick.
export function progressSales(state) {
  const prospect = state.prospects.find((p) => p.working);
  if (!prospect) return;
  const player = state.techs.find((t) => t.id === 'you');
  prospect.salesProgress += player.salesSkill * moraleFactor(player.morale);
  if (prospect.salesProgress < prospect.salesEffort) return;

  state.prospects = state.prospects.filter((p) => p.id !== prospect.id);
  const persona = PERSONALITIES[prospect.personality];
  let ghost = PROSPECTS.GHOST_BASE * persona.ghostMult;
  if (state.reputation < 30) ghost += PROSPECTS.GHOST_LOW_REP;
  if (chance(state, ghost)) {
    state.counters.ghosted++;
    log(state, `${prospect.name} ghosted after the quote. Classic.`, 'bad');
    return;
  }
  const client = makeClient(state, prospect.tier, {
    name: prospect.name, size: prospect.size, personality: prospect.personality,
  });
  state.clients.push(client);
  state.counters.signed++;
  log(state, `SIGNED: ${client.name} (${client.size} seats, ${client.tier.replace('_', '+')})`, 'good');
}
