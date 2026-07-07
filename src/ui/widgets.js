// Small stateless UI helpers shared across panels. Everything here returns
// plain Phaser GameObjects/Containers — panels destroy() and rebuild these
// on every refresh() rather than diffing, which is simple and cheap at
// ~1 refresh/sec.

import { COLORS, FONT } from '../theme.js';

export function panel(scene, x, y, w, h, title) {
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, COLORS.panelBg).setOrigin(0);
  bg.setStrokeStyle(1, COLORS.panelBorder);
  c.add(bg);
  let headerH = 0;
  if (title) {
    headerH = 30;
    const header = scene.add.rectangle(0, 0, w, headerH, COLORS.panelHeaderBg).setOrigin(0);
    header.setStrokeStyle(1, COLORS.panelBorder);
    const label = scene.add.text(10, headerH / 2, title, {
      fontFamily: FONT, fontSize: '13px', color: COLORS.text, fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    c.add([header, label]);
  }
  c.contentY = headerH + 8;
  c.width = w;
  c.height = h;
  return c;
}

export function button(scene, x, y, w, h, label, { onClick, enabled = true, tone = 'accent', fontSize = '12px' } = {}) {
  const palette = {
    accent: { bg: COLORS.accent, bgHover: 0x255bc4, text: '#ffffff' },
    good: { bg: COLORS.good, bgHover: 0x17803f, text: '#ffffff' },
    bad: { bg: COLORS.bad, bgHover: 0xb32d2d, text: '#ffffff' },
    muted: { bg: 0xdfe4ea, bgHover: 0xd0d6de, text: COLORS.text },
  }[tone];

  const c = scene.add.container(x, y);
  const bgColor = enabled ? palette.bg : COLORS.disabled;
  const bg = scene.add.rectangle(0, 0, w, h, bgColor).setOrigin(0);
  const txt = scene.add.text(w / 2, h / 2, label, {
    fontFamily: FONT, fontSize, color: enabled ? palette.text : '#ffffff',
  }).setOrigin(0.5);
  c.add([bg, txt]);

  if (enabled && onClick) {
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(palette.bgHover));
    bg.on('pointerout', () => bg.setFillStyle(palette.bg));
    bg.on('pointerdown', onClick);
  }
  c.setSize(w, h);
  return c;
}

export function progressBar(scene, x, y, w, h, frac, color, bgColor = 0xe3e7ed) {
  const c = scene.add.container(x, y);
  const track = scene.add.rectangle(0, 0, w, h, bgColor).setOrigin(0);
  const fillW = Math.max(0, Math.min(1, frac)) * w;
  const fill = scene.add.rectangle(0, 0, fillW, h, color).setOrigin(0);
  c.add([track, fill]);
  return c;
}

export function label(scene, x, y, text, opts = {}) {
  return scene.add.text(x, y, text, {
    fontFamily: FONT, fontSize: '12px', color: COLORS.text, ...opts,
  });
}

export function badge(scene, x, y, text, color, textColor = '#ffffff') {
  const c = scene.add.container(x, y);
  const t = scene.add.text(0, 0, text, { fontFamily: FONT, fontSize: '11px', color: textColor, fontStyle: 'bold' });
  const w = t.width + 10, h = t.height + 4;
  const bg = scene.add.rectangle(0, 0, w, h, color).setOrigin(0);
  t.setPosition(5, 2);
  c.add([bg, t]);
  return c;
}

export function divider(scene, x, y, w) {
  return scene.add.rectangle(x, y, w, 1, COLORS.panelBorder).setOrigin(0);
}
