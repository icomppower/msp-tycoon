// A simple centered modal overlay. Only one can be open at a time per scene
// (scene.activeModal). Used for ticket assignment and confirmations.

import { COLORS, FONT } from '../theme.js';
import { button, label } from './widgets.js';

export function openModal(scene, { title, width = 360, height = 300, build }) {
  closeModal(scene);

  // Clamp to the viewport so modals never overflow a narrow mobile canvas.
  width = Math.min(width, scene.scale.width - 24);
  height = Math.min(height, scene.scale.height - 24);

  const overlay = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x0a0e14, 0.45)
    .setOrigin(0).setInteractive();
  overlay.on('pointerdown', () => closeModal(scene));

  const x = (scene.scale.width - width) / 2;
  const y = (scene.scale.height - height) / 2;
  const box = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, width, height, COLORS.panelBg).setOrigin(0);
  bg.setStrokeStyle(1, COLORS.panelBorder);
  bg.setInteractive(); // swallow clicks so they don't bubble to overlay
  const header = scene.add.rectangle(0, 0, width, 34, COLORS.navBg).setOrigin(0);
  const headerText = scene.add.text(12, 17, title, {
    fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
  }).setOrigin(0, 0.5);
  const closeBtn = button(scene, width - 30, 5, 24, 24, 'x', {
    tone: 'muted', onClick: () => closeModal(scene),
  });
  box.add([bg, header, headerText, closeBtn]);

  if (build) build(box, width, height);

  scene.activeModal = { overlay, box };
  return box;
}

export function closeModal(scene) {
  if (!scene.activeModal) return;
  scene.activeModal.overlay.destroy();
  scene.activeModal.box.destroy();
  scene.activeModal = null;
}
