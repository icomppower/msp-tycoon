// Ironic PSA-dashboard palette: bright corporate SaaS, not moody game UI.
// The joke only lands if this looks like a ticketing tool your MSP already pays for.

export const COLORS = {
  appBg: 0xe9edf3,
  navBg: 0x152238,
  navText: '#ffffff',
  panelBg: 0xffffff,
  panelBorder: 0xd2dae5,
  panelHeaderBg: 0xf3f6fa,
  text: '#1c2733',
  textMuted: '#6b7684',
  textFaint: '#98a2b0',
  accent: 0x2f6fed,
  accentText: '#2f6fed',
  good: 0x1f9d55,
  goodText: '#1f9d55',
  warn: 0xd98c0f,
  warnText: '#b06f00',
  bad: 0xd93a3a,
  badText: '#c62828',
  rowAlt: 0xf7f9fc,
  rowHover: 0xeaf1ff,
  disabled: 0xc7ccd3,
};

export const SEVERITY_COLOR = {
  1: COLORS.bad,
  2: 0xe8722c,
  3: COLORS.warn,
  4: COLORS.textFaint,
};
export const SEVERITY_TEXT = { 1: '#c62828', 2: '#c8541a', 3: '#b06f00', 4: '#6b7684' };
export const SEVERITY_LABEL = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };

export const TIER_LABEL = {
  breakfix: 'Break-Fix',
  managed: 'Managed',
  managed_security: 'Managed+Sec',
};
export const TIER_COLOR = {
  breakfix: 0x8a94a3,
  managed: COLORS.accent,
  managed_security: 0x7a3fd9,
};

export const LOG_COLOR = {
  good: COLORS.goodText,
  bad: COLORS.badText,
  info: COLORS.textMuted,
  warn: COLORS.warnText,
  money: '#1c2733',
  event: '#7a3fd9',
  stage: COLORS.accentText,
  auto: '#0f8f7d',
  gameover: COLORS.badText,
};

export const FONT = 'Consolas, "SF Mono", Menlo, monospace';

export function patienceColor(p) {
  if (p >= 60) return COLORS.good;
  if (p >= 30) return COLORS.warn;
  return COLORS.bad;
}

export function moraleColor(m) {
  if (m >= 60) return COLORS.good;
  if (m >= 30) return COLORS.warn;
  return COLORS.bad;
}

export function slaColor(ticksLeft, breached) {
  if (breached) return COLORS.bad;
  if (ticksLeft <= 2) return COLORS.bad;
  if (ticksLeft <= 8) return COLORS.warn;
  return COLORS.good;
}
