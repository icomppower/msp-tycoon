// Upgrade trees as pure data. `requires` = previous node in the tree.
// `minStage` gates the security tree behind stage 3 per the GDD.
// `upkeepWeek` is billed by economy.js via the upkeep_week stat.

export const UPGRADES = {
  // ─── RMM tree ───────────────────────────────────────────────
  rmm_monitoring: {
    tree: 'rmm', tier: 1, name: 'Basic Monitoring', cost: 800, upkeepWeek: 40,
    blurb: 'See tickets before clients call. The SLA clock starts late.',
    effects: [{ stat: 'monitoring_lead', op: 'add', value: 2 }],
  },
  rmm_patching: {
    tree: 'rmm', tier: 2, name: 'Patch Automation', cost: 1500, upkeepWeek: 60, requires: 'rmm_monitoring',
    blurb: 'Boring problems stop happening. −20% ticket spawn.',
    effects: [{ stat: 'spawn_mult', op: 'mult', value: 0.8 }],
  },
  rmm_autoremediation: {
    tree: 'rmm', tier: 3, name: 'Auto-Remediation', cost: 3000, upkeepWeek: 80, requires: 'rmm_patching',
    blurb: 'Scripts fix P4s while you sleep. Bills at half rate, complains never.',
    effects: [{ stat: 'auto_resolve_p4', op: 'add', value: 0.35 }],
  },
  rmm_scripting: {
    tree: 'rmm', tier: 4, name: 'Scripting Library', cost: 2500, upkeepWeek: 0, requires: 'rmm_autoremediation',
    blurb: 'Password resets are now a keystroke.',
    effects: [{ stat: 'instant_type:password_reset', op: 'flag' }],
  },

  // ─── Security tree (unlocks at stage 3) ─────────────────────
  sec_av: {
    tree: 'security', tier: 1, name: 'Managed Antivirus', cost: 1200, upkeepWeek: 50, minStage: 3,
    blurb: 'Catches the malware from 2019. Halves incident volume.',
    effects: [{ stat: 'incident_spawn_mult', op: 'mult', value: 0.5 }],
  },
  sec_edr: {
    tree: 'security', tier: 2, name: 'EDR', cost: 2800, upkeepWeek: 90, requires: 'sec_av', minStage: 3,
    blurb: 'Incidents get caught early — one severity less scary.',
    effects: [{ stat: 'incident_downgrade', op: 'flag' }],
  },
  sec_siem: {
    tree: 'security', tier: 3, name: 'SIEM', cost: 4500, upkeepWeek: 120, requires: 'sec_edr', minStage: 3,
    blurb: 'A day of warning before chaos hits. The dashboard has 40 widgets.',
    effects: [{ stat: 'siem_warning', op: 'flag' }],
  },
  sec_sat: {
    tree: 'security', tier: 4, name: 'Security Awareness Training', cost: 2000, upkeepWeek: 40, requires: 'sec_siem', minStage: 3,
    blurb: 'They stopped clicking the phishing links. Mostly.',
    effects: [{ stat: 'self_inflict_mult', op: 'mult', value: 0.5 }],
  },

  // ─── Business tree ──────────────────────────────────────────
  biz_psa: {
    tree: 'business', tier: 1, name: 'PSA / Ticketing', cost: 1000, upkeepWeek: 50,
    blurb: 'Tickets in a system instead of a notepad. +1 capacity, all techs.',
    effects: [{ stat: 'capacity_add', op: 'add', value: 1 }],
  },
  biz_docs: {
    tree: 'business', tier: 2, name: 'Documentation Platform', cost: 1800, upkeepWeek: 45, requires: 'biz_psa',
    blurb: 'The passwords are written down somewhere findable. New hires ramp 2× faster.',
    effects: [{ stat: 'ramp_mult', op: 'mult', value: 0.5 }],
  },
  biz_afterhours: {
    tree: 'business', tier: 3, name: 'After-Hours Answering', cost: 2200, upkeepWeek: 100, requires: 'biz_docs',
    blurb: 'A calm voice at 2am. Off-hours breaches stop bleeding patience.',
    effects: [{ stat: 'after_hours_cover', op: 'flag' }],
  },
  biz_vcio: {
    tree: 'business', tier: 4, name: 'vCIO Offering', cost: 5000, upkeepWeek: 0, requires: 'biz_afterhours',
    blurb: 'You now attend quarterly business reviews. Unlocks Managed+Security deals.',
    effects: [{ stat: 'vcio', op: 'flag' }],
  },
};

export function canBuy(state, id) {
  const up = UPGRADES[id];
  if (!up) return { ok: false, reason: 'unknown upgrade' };
  if (state.upgrades.includes(id)) return { ok: false, reason: 'already owned' };
  if (up.requires && !state.upgrades.includes(up.requires)) return { ok: false, reason: `requires ${UPGRADES[up.requires].name}` };
  if (up.minStage && state.stage < up.minStage) return { ok: false, reason: `unlocks at stage ${up.minStage}` };
  if (state.cash < up.cost) return { ok: false, reason: 'not enough cash' };
  return { ok: true };
}
