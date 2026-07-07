// The tick engine and the full player-action API. The UI layer should only
// ever call createGame / tick / actions.* / selectors — never mutate state.

import { TIME, STAGES, ECONOMY, CLIENTS } from './constants.js';
import { createInitialState, log, mrrPerMonth, clock } from './state.js';
import { spawnTickets, progressTickets, checkSLAs } from './tickets.js';
import { weeklyClientPass, dailyProspectPass, progressSales } from './clients.js';
import { autoAssign, hasDispatcher, ticketPriority } from './dispatcher.js';
import { tickEvents } from './events.js';
import { hourlyEconomy, weeklyEconomy, weeklyExpenses } from './economy.js';
import { makeTech } from './entities.js';
import { UPGRADES, canBuy } from './upgrades.js';
import { TECHS } from './constants.js';
import { GAME_OVER_COPY } from './content.js';

export function createGame(seed = 1) {
  return createInitialState(seed);
}

// 1 tick = 1 game hour. Call once per real second (or whatever cadence the UI
// wants — the engine only knows ticks).
export function tick(state) {
  if (state.gameOver) return state;
  state.tick++;

  spawnTickets(state);
  tickEvents(state);
  if (hasDispatcher(state)) autoAssign(state);
  progressTickets(state);
  progressSales(state);
  checkSLAs(state);
  hourlyEconomy(state);

  if (state.tick % TIME.TICKS_PER_DAY === 0) dailyProspectPass(state);
  if (state.tick % TIME.TICKS_PER_WEEK === 0) {
    weeklyEconomy(state);
    weeklyClientPass(state);
  }

  updateStage(state);
  return state;
}

function updateStage(state) {
  const n = state.clients.length;
  let stage = 1;
  for (let i = 1; i < STAGES.THRESHOLDS.length; i++) {
    if (n >= STAGES.THRESHOLDS[i]) stage = i + 1;
  }
  if (stage > state.stage) {
    state.stage = stage; // stages don't regress on churn
    log(state, `STAGE ${stage}: ${['', 'garage', 'first hires', 'a real MSP', 'regional player'][stage]}`, 'stage');
  }
}

// ─── Player actions ───────────────────────────────────────────
// Every action returns { ok, reason? } and never throws.

export const actions = {
  assignTicket(state, ticketId, techId) {
    const ticket = state.tickets.find((t) => t.id === ticketId);
    const tech = state.techs.find((t) => t.id === techId);
    if (!ticket) return { ok: false, reason: 'no such ticket' };
    if (!tech) return { ok: false, reason: 'no such tech' };
    if (tech.role === 'dispatcher') return { ok: false, reason: 'dispatchers route tickets, they do not fix them' };
    ticket.assignedTo = techId;
    return { ok: true };
  },

  unassignTicket(state, ticketId) {
    const ticket = state.tickets.find((t) => t.id === ticketId);
    if (!ticket) return { ok: false, reason: 'no such ticket' };
    ticket.assignedTo = null;
    return { ok: true };
  },

  triageTicket(state, ticketId) {
    const ticket = state.tickets.find((t) => t.id === ticketId);
    if (!ticket) return { ok: false, reason: 'no such ticket' };
    ticket.triaged = true;
    return { ok: true, actualSeverity: ticket.actualSeverity };
  },

  hireTech(state, role) {
    if (!TECHS.ROLES[role]) return { ok: false, reason: 'unknown role' };
    const tech = makeTech(state, role);
    state.techs.push(tech);
    log(state, `hired ${tech.name} (${role}, $${tech.salaryWeek}/wk)`, 'info');
    return { ok: true, tech };
  },

  fireTech(state, techId) {
    if (techId === 'you') return { ok: false, reason: 'you cannot fire yourself (you have tried)' };
    const tech = state.techs.find((t) => t.id === techId);
    if (!tech) return { ok: false, reason: 'no such tech' };
    state.techs = state.techs.filter((t) => t.id !== techId);
    for (const ticket of state.tickets) if (ticket.assignedTo === techId) ticket.assignedTo = null;
    log(state, `let ${tech.name} go.`, 'info');
    return { ok: true };
  },

  buyUpgrade(state, upgradeId) {
    const check = canBuy(state, upgradeId);
    if (!check.ok) return check;
    state.cash -= UPGRADES[upgradeId].cost;
    state.upgrades.push(upgradeId);
    log(state, `purchased: ${UPGRADES[upgradeId].name}`, 'info');
    return { ok: true };
  },

  // Start working a prospect. Occupies one player capacity slot until closed.
  workProspect(state, prospectId) {
    const prospect = state.prospects.find((p) => p.id === prospectId);
    if (!prospect) return { ok: false, reason: 'no such prospect' };
    if (state.prospects.some((p) => p.working && p.id !== prospectId)) {
      return { ok: false, reason: 'already working a deal — one at a time' };
    }
    prospect.working = true;
    return { ok: true };
  },

  stopSales(state) {
    for (const p of state.prospects) p.working = false;
    return { ok: true };
  },

  // Prestige: sell the MSP. Valuation ≈ 1 year of MRR scaled by reputation.
  sellMSP(state) {
    if (state.stage < STAGES.SELL_STAGE) return { ok: false, reason: 'nobody buys a garage operation' };
    const score = Math.round(state.cash + mrrPerMonth(state) * 12 * (0.5 + state.reputation / 100));
    state.gameOver = { reason: 'sold', tick: state.tick, score };
    log(state, GAME_OVER_COPY.sold, 'gameover');
    return { ok: true, score };
  },
};

// ─── Selectors (read-only helpers for the UI) ─────────────────

export const selectors = {
  clock,
  mrrPerMonth,
  weeklyExpenses,
  ticketPriority,
  queue: (state) =>
    [...state.tickets].sort((a, b) => ticketPriority(state, b) - ticketPriority(state, a)),
  techLoad: (state, techId) => state.tickets.filter((t) => t.assignedTo === techId),
  clientHealth: (state) =>
    [...state.clients].sort((a, b) => a.patience - b.patience),
};
