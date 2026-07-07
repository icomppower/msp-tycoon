// Game state: a single plain-JSON object. serialize()/deserialize() are
// trivial by design — no classes, no Maps, no functions in state.

import { TIME, ECONOMY, LOG_CAP, CLIENTS } from './constants.js';
import { makeClient, makePlayer } from './entities.js';

export function createInitialState(seed = 1) {
  const state = {
    version: 1,
    seed,
    rng: seed | 0,
    tick: 0,
    cash: ECONOMY.START_CASH,
    reputation: ECONOMY.START_REPUTATION,
    stage: 1,
    debtTicks: 0,
    gameOver: null, // { reason: 'broke' | 'sold', tick, score? }
    vendorMult: 1,  // vendor_price_hike ratchets this up
    clients: [],
    tickets: [],
    techs: [],
    prospects: [],
    upgrades: [],
    activeEffects: [],  // [{ id, untilTick, mods?, data? }]
    pendingEvents: [],  // [{ eventId, fireTick, warned }] — SIEM shows these
    counters: {
      clientSeq: 1, ticketSeq: 1, techSeq: 1, prospectSeq: 1,
      spawned: 0, resolved: 0, autoResolved: 0, breached: 0, abandoned: 0,
      botched: 0, churned: 0, signed: 0, ghosted: 0, quit: 0,
      breakfixRevenue: 0, mrrRevenue: 0,
    },
    log: [],
  };

  state.techs.push(makePlayer(state));
  // Garage start: you + 3 break-fix clients, per the GDD progression arc.
  for (let i = 0; i < 3; i++) {
    const c = makeClient(state, 'breakfix');
    c.personality = i === 0 ? 'escalator' : 'normal'; // guarantee the tutorial joke
    state.clients.push(c);
  }
  return state;
}

export function clock(state) {
  const hour = state.tick % TIME.TICKS_PER_DAY;
  const day = Math.floor(state.tick / TIME.TICKS_PER_DAY) % 7; // 0 = Monday
  const week = Math.floor(state.tick / TIME.TICKS_PER_WEEK);
  return { hour, day, week };
}

export function log(state, msg, kind = 'info') {
  state.log.push({ tick: state.tick, msg, kind });
  if (state.log.length > LOG_CAP) state.log.splice(0, state.log.length - LOG_CAP);
}

export function mrrPerMonth(state) {
  return state.clients.reduce(
    (sum, c) => sum + c.size * CLIENTS.SEAT_PRICE_MONTH * CLIENTS.MRR_MULT[c.tier], 0);
}

export const serialize = (state) => JSON.stringify(state);
export const deserialize = (json) => JSON.parse(json);
