// Headless balance harness. Runs scripted player policies against the engine
// and asserts the target difficulty curve:
//   1. Determinism + save/load round-trip.
//   2. NAIVE (assigns to self, never grows): stage 1 must be survivable.
//   3. GROWTH (triage, hire, upgrade, sell): should reach a real MSP and stay solvent.
//   4. RECKLESS (signs everything, never hires): the SLA/churn system must punish it.
//
// Run: npm run balance

import { createGame, tick, actions, serialize, deserialize, selectors, canBuy, UPGRADES } from '../src/engine/index.js';
import { autoAssign, hasDispatcher } from '../src/engine/dispatcher.js';
import { effectiveCapacity } from '../src/engine/tickets.js';

const WEEK = 168;
let failures = 0;

function assert(cond, label) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function avgPatience(state) {
  if (!state.clients.length) return 0;
  return state.clients.reduce((s, c) => s + c.patience, 0) / state.clients.length;
}

function summarize(name, state) {
  const c = state.counters;
  console.log(
    `  [${name}] wk${Math.floor(state.tick / WEEK)} cash=$${Math.round(state.cash)} ` +
    `clients=${state.clients.length} techs=${state.techs.length} rep=${Math.round(state.reputation)} ` +
    `patience=${Math.round(avgPatience(state))} stage=${state.stage} | ` +
    `spawned=${c.spawned} resolved=${c.resolved} breached=${c.breached} abandoned=${c.abandoned} ` +
    `botched=${c.botched} churned=${c.churned} signed=${c.signed} quit=${c.quit}` +
    (state.gameOver ? ` | GAME OVER (${state.gameOver.reason})` : '')
  );
}

function run(policy, seed, weeks) {
  const state = createGame(seed);
  for (let i = 0; i < weeks * WEEK && !state.gameOver; i++) {
    policy(state);
    tick(state);
  }
  return state;
}

// ─── Policies ─────────────────────────────────────────────────

// Assigns oldest unassigned tickets to self when a slot is free. Nothing else.
function naive(state) {
  const me = state.techs[0];
  const mine = state.tickets.filter((t) => t.assignedTo === 'you').length;
  let free = effectiveCapacity(state, me) - mine;
  for (const t of state.tickets) {
    if (free <= 0) break;
    if (!t.assignedTo) { actions.assignTicket(state, t.id, 'you'); free--; }
  }
}

// Plays reasonably: triages, dispatches by priority, buys tools, hires ahead
// of drowning, works the pipeline when the queue is calm.
const GROWTH_WISHLIST = [
  'biz_psa', 'rmm_monitoring', 'rmm_patching', 'biz_docs', 'rmm_autoremediation',
  'biz_afterhours', 'sec_av', 'rmm_scripting', 'sec_edr', 'sec_siem', 'biz_vcio', 'sec_sat',
];
function growth(state) {
  for (const t of state.tickets) if (!t.triaged) actions.triageTicket(state, t.id);

  for (const id of GROWTH_WISHLIST) {
    if (canBuy(state, id).ok && state.cash > UPGRADES[id].cost + 4000) actions.buyUpgrade(state, id);
  }

  // Hire only under sustained pressure, with salary runway banked, at most
  // one hire per two weeks, and never more than ~1 tech per 3 clients —
  // chaos-event queue spikes are not a reason to triple headcount.
  const scratch = (state._bot ??= { lastHire: -9999 });
  const workers = state.techs.filter((t) => t.role !== 'dispatcher');
  const open = state.tickets.length;
  const canHire = state.tick - scratch.lastHire > 336 && workers.length < state.clients.length / 3 + 1;
  if (canHire && open > workers.length * 6 && state.cash > 12000) {
    actions.hireTech(state, 'tech'); scratch.lastHire = state.tick;
  } else if (canHire && open > workers.length * 5 && state.cash > 7000) {
    actions.hireTech(state, 'junior'); scratch.lastHire = state.tick;
  }
  if (workers.length >= 3 && !hasDispatcher(state) && state.cash > 13000) actions.hireTech(state, 'dispatcher');

  if (!hasDispatcher(state)) autoAssign(state); // the player micromanaging the queue

  const selling = state.prospects.some((p) => p.working);
  if (!selling && state.prospects.length && open < workers.length * 3) {
    actions.workProspect(state, state.prospects[0].id);
  }
}

// Signs every deal, never hires, shovels every ticket at himself.
function reckless(state) {
  if (!state.prospects.some((p) => p.working) && state.prospects.length) {
    actions.workProspect(state, state.prospects[0].id);
  }
  for (const t of state.tickets) if (!t.assignedTo) actions.assignTicket(state, t.id, 'you');
}

// ─── 1. Determinism + serialization ───────────────────────────

console.log('\n— determinism & save/load —');
{
  const a = createGame(42);
  const b = createGame(42);
  for (let i = 0; i < 500; i++) { naive(a); tick(a); naive(b); tick(b); }
  assert(serialize(a) === serialize(b), 'same seed → identical state after 500 ticks');

  const c = createGame(7);
  for (let i = 0; i < 300; i++) { naive(c); tick(c); }
  const d = deserialize(serialize(c));
  for (let i = 0; i < 200; i++) { naive(c); tick(c); naive(d); tick(d); }
  assert(serialize(c) === serialize(d), 'save/load mid-run → identical continuation');
}

// ─── 2. Action API sanity ─────────────────────────────────────

console.log('\n— action API —');
{
  const s = createGame(3);
  assert(actions.assignTicket(s, 'nope', 'you').ok === false, 'bad ticket id rejected');
  assert(actions.fireTech(s, 'you').ok === false, 'cannot fire yourself');
  assert(actions.sellMSP(s).ok === false, 'cannot sell a garage operation');
  s.cash = 100000;
  assert(canBuy(s, 'rmm_patching').ok === false, 'upgrade prerequisites enforced');
  assert(canBuy(s, 'sec_av').ok === false, 'security tree stage-gated');
  const capBefore = effectiveCapacity(s, s.techs[0]);
  actions.buyUpgrade(s, 'biz_psa');
  assert(effectiveCapacity(s, s.techs[0]) === capBefore + 1, 'PSA grants +1 capacity via modifier');
}

// ─── 3. Difficulty curve ──────────────────────────────────────

const SEEDS = [1, 2, 3, 4, 5];

console.log('\n— NAIVE bot, 8 weeks (stage 1 must be survivable) —');
for (const seed of SEEDS) {
  const s = run(naive, seed, 8);
  summarize(`naive s${seed}`, s);
  assert(!s.gameOver, `s${seed}: survives`);
  assert(s.cash > 3000, `s${seed}: solo break-fix pays the bills (cash $${Math.round(s.cash)})`);
  assert(s.counters.churned <= 1, `s${seed}: loses at most 1 client (churned ${s.counters.churned})`);
}

console.log('\n— GROWTH bot, 16 weeks (should become a real MSP) —');
for (const seed of SEEDS) {
  const s = run(growth, seed, 16);
  summarize(`growth s${seed}`, s);
  assert(!s.gameOver, `s${seed}: survives`);
  assert(s.clients.length >= 6, `s${seed}: grows to 6+ clients (${s.clients.length})`);
  assert(s.techs.length >= 2, `s${seed}: makes hires (${s.techs.length} techs)`);
  assert(avgPatience(s) > 45, `s${seed}: keeps clients happy (avg patience ${Math.round(avgPatience(s))})`);
  assert(s.upgrades.length >= 3, `s${seed}: invests in tooling (${s.upgrades.length} upgrades)`);
}

console.log('\n— RECKLESS bot, 16 weeks (the game must push back) —');
{
  let punished = 0;
  for (const seed of SEEDS) {
    const s = run(reckless, seed, 16);
    summarize(`reckless s${seed}`, s);
    const pain = s.counters.churned >= 2 || s.counters.abandoned >= 20 || avgPatience(s) < 40 || s.gameOver;
    if (pain) punished++;
  }
  assert(punished >= 4, `overexpansion punished in ${punished}/5 seeds`);
}

// ─── Verdict ──────────────────────────────────────────────────

console.log('');
if (failures) {
  console.error(`${failures} balance assertion(s) failed`);
  process.exit(1);
}
console.log('all balance targets met ✓');
