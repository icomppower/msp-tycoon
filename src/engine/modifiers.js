// Composable modifier system. Upgrades (and temporary chaos effects) declare
// data — { stat, op, value } — and the engine reads stats through getStat().
// No upgrade is ever checked by name outside upgrades.js; adding a new upgrade
// means adding data, not branches.
//
// Ops: 'add' (applied first), 'mult' (applied after), 'flag' (boolean gate).
//
// Stats consumed by the engine:
//   spawn_mult            — global ticket spawn multiplier
//   capacity_add          — extra concurrent-ticket slots per working tech
//   auto_resolve_p4       — chance a spawning actual-P4 auto-remediates
//   instant_type:<type>   — that ticket type resolves at effort 0.5
//   incident_spawn_mult   — multiplier on security_incident spawns/events
//   incident_downgrade    — security incidents drop one severity (flag)
//   ramp_mult             — new-hire ramp duration multiplier
//   after_hours_cover     — off-hours SLA breaches do no patience damage (flag)
//   vcio                  — unlocks managed+security prospects (flag)
//   monitoring_lead       — ticks of early warning before SLA clock starts
//   siem_warning          — chaos events pre-announced (flag)
//   self_inflict_mult     — multiplier on client-caused incidents (SAT)
//   upkeep_week           — summed weekly tool subscription cost

import { UPGRADES } from './upgrades.js';

export function activeModifiers(state) {
  const mods = [];
  for (const id of state.upgrades) {
    const up = UPGRADES[id];
    if (up) mods.push(...up.effects);
  }
  for (const eff of state.activeEffects) {
    if (eff.mods) mods.push(...eff.mods);
  }
  return mods;
}

export function getStat(state, stat, base = 0) {
  let v = base;
  const mods = activeModifiers(state);
  for (const m of mods) if (m.stat === stat && m.op === 'add') v += m.value;
  for (const m of mods) if (m.stat === stat && m.op === 'mult') v *= m.value;
  return v;
}

export function hasFlag(state, stat) {
  return activeModifiers(state).some((m) => m.stat === stat && m.op === 'flag');
}
