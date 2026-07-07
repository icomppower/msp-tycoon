// Every balance number in the game lives here. The balance harness
// (test/balance.js) asserts a target difficulty curve against these values —
// if you tune one, run `npm run balance`.

export const TIME = {
  TICKS_PER_DAY: 24,
  TICKS_PER_WEEK: 168,
  TICKS_PER_MONTH: 720, // 30 game-days; MRR accrues against this
};

export const SEVERITY = {
  // 1 = P1 "server down" … 4 = P4 "my mouse feels slow"
  // Claimed-severity distribution before mislabeling.
  SPAWN_WEIGHTS: [[1, 6], [2, 16], [3, 32], [4, 46]],
  // Effort ranges in skill-hours (a skill-3 tech does 3 effort/tick at full
  // morale). Sized against 24/7 ticks, not an 8h day — a real P1 is a
  // half-day scramble even for a senior.
  EFFORT: { 1: [18, 36], 2: [14, 28], 3: [8, 16], 4: [4, 8] },
  // Ticks from spawn to SLA breach, scaled by client tier SLA_MULT.
  SLA_TICKS: { 1: 8, 2: 16, 3: 36, 4: 96 },
  // Patience damage on breach, keyed by CLAIMED severity — the client believes
  // their label, so an Escalator's fake P1 still hurts when it breaches.
  BREACH_PENALTY: { 1: 18, 2: 12, 3: 7, 4: 3 },
  // Minimum skill for a clean resolve, keyed by ACTUAL severity.
  REQ_SKILL: { 1: 4, 2: 3, 3: 2, 4: 1 },
};

export const TICKETS = {
  BASE_SPAWN_PER_SEAT: 0.012, // tickets per seat per tick, before multipliers
  TIER_SPAWN_FACTOR: { breakfix: 1.0, managed: 0.8, managed_security: 0.65 },
  MISLABEL_UP: 0.22,   // claimed severity inflated to P1 ("URGENT!!")
  MISLABEL_DOWN: 0.05, // real P1 filed as P4 ("minor: server room smells like smoke")
  BOTCH_BASE: 0.06,    // × skill gap; botched ticket respawns one severity worse
  ABANDON_MULT: 3,     // unresolved past SLA × this → client gives up (-patience)
  ABANDON_PENALTY: 12,
  GOODWILL_FAST: 2,    // resolved under 40% of SLA
  GOODWILL_ANY: 0.5,
  FAST_RESOLVE_FRAC: 0.4,
  FRIDAY_SPIKE_HOUR: 16, // "Friday 4:55pm" — the 16:00–17:00 tick
  FRIDAY_SPIKE_MULT: 4,
};

// Spawn multiplier by time of day. day 0 = Monday.
export function todMult(day, hour) {
  const weekend = day >= 5;
  if (weekend) return hour >= 8 && hour < 20 ? 0.3 : 0.1;
  if (hour >= 8 && hour < 18) return 1.0;
  if (hour >= 18 && hour < 23) return 0.35;
  return 0.12;
}

export function isBusinessHours(day, hour) {
  return day < 5 && hour >= 8 && hour < 18;
}

export const CLIENTS = {
  SEAT_PRICE_MONTH: 40, // × tier MRR_MULT = $/seat/month
  MRR_MULT: { breakfix: 0, managed: 3, managed_security: 5 },
  SLA_MULT: { breakfix: 1.5, managed: 1.0, managed_security: 0.75 },
  SIZE: { breakfix: [3, 9], managed: [8, 25], managed_security: [15, 40] },
  START_PATIENCE: 70,
  CHURN_THRESHOLD: 30, // weekly churn roll below this
  CHURN_MIDPOINT: 22,  // sigmoid((MIDPOINT - patience) / CHURN_K)
  CHURN_K: 6,
  CHURN_GRACE_WEEKS: 2, // new clients don't churn-roll yet
  WEEKLY_RECOVERY: 2,   // patience regained per breach-free week
  PATIENCE_MAX: 100,
};

export const TECHS = {
  // Player character: free, decent all-rounder, the "solo operator" start.
  PLAYER: { salaryWeek: 0, capacity: 2, skillRange: [3, 3], salesSkill: 3 },
  ROLES: {
    junior:     { salaryWeek: 700,  capacity: 1, skillRange: [1, 2] },
    tech:       { salaryWeek: 1200, capacity: 2, skillRange: [2, 3] },
    senior:     { salaryWeek: 2000, capacity: 2, skillRange: [4, 4] },
    dispatcher: { salaryWeek: 1300, capacity: 0, skillRange: [1, 1] }, // doesn't work tickets; auto-assigns + auto-triages
  },
  START_MORALE: 80,
  MORALE_WORK_DRAIN: 0.04,   // per assigned ticket per tick
  MORALE_P1_DRAIN: 0.08,     // extra per tick while holding any actual-P1
  MORALE_MAXED_DRAIN: 0.05,  // extra per tick at full capacity
  MORALE_IDLE_RECOVERY: 0.25,
  MORALE_QUIT_THRESHOLD: 20,
  MORALE_QUIT_PROB: 0.25,    // weekly roll below threshold (player can't quit)
  RAMP_WEEKS: 2,             // new hires work at −1 skill while ramping
};

// resolve speed = skill × moraleFactor; 0.5 at zero morale, 1.0 at 100.
export function moraleFactor(morale) {
  return 0.5 + morale / 200;
}

export const ECONOMY = {
  START_CASH: 3000,
  START_REPUTATION: 30,
  // Deliberately mediocre per-ticket money: break-fix should feel spiky and
  // labor-bound next to MRR — that's the MSP lesson the economy teaches.
  BREAKFIX_BASE: 15,
  BREAKFIX_PER_EFFORT: 5,
  AUTO_RESOLVE_PAYOUT: 0.5, // auto-remediated tickets bill at half
  RENT_BASE_WEEK: 150,
  RENT_PER_TECH_WEEK: 120, // per tech beyond the player
  FAIL_DEBT_TICKS: 336,    // cash < 0 for 2 game-weeks → game over
};

export const REPUTATION = {
  CHURN_HIT: 6,
  P1_BREACH_HIT: 1.5,
  HAPPY_CLIENT_WEEKLY: 0.25, // per breach-free client per week
  PROSPECT_MANAGED_MIN: 40,  // rep gate for managed-tier prospects
  PROSPECT_MSEC_MIN: 70,     // rep gate for managed+security (also needs vCIO)
  REFERRAL_MIN: 55,
};

export const PROSPECTS = {
  DAILY_SPAWN_BASE: 0.22,   // + rep / DAILY_SPAWN_REP_DIV, rolled once per day
  DAILY_SPAWN_REP_DIV: 400,
  PIPELINE_CAP: 3,
  SALES_EFFORT: [8, 20],    // skill-hours of the player's sales skill
  GHOST_BASE: 0.15,
  GHOST_LOW_REP: 0.2,       // added when reputation < 30
  EXPIRE_TICKS: 336,        // prospects leave the pipeline after 2 weeks
};

export const STAGES = {
  // Derived from client count; stage gates features (see sim.js).
  THRESHOLDS: [0, 8, 15, 30], // stage 1 / 2 / 3 / 4
  CHAOS_STAGE: 3,
  MILD_CHAOS_STAGE: 2,
  POACH_STAGE: 4,
  SELL_STAGE: 4,
};

export const CHAOS = {
  TICK_CHANCE: 1 / 120,     // ~one event per 5 game-days at full stage
  MILD_FACTOR: 0.5,         // stage-2 rate for mild events only
  SIEM_WARNING_TICKS: 24,
};

export const LOG_CAP = 120;
