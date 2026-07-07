import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import DashboardScene from './scenes/DashboardScene.js';
import { COLORS } from './theme.js';

// Detect phones/narrow windows by the smallest viewport side, not just
// width — a phone in landscape still has a small short axis, while a
// resized desktop window rarely does. Below that, use a portrait logical
// canvas with a single-panel tabbed layout instead of the 3-column grid.
const smallSide = Math.min(window.innerWidth, window.innerHeight);
const isMobile = smallSide < 700;
const width = isMobile ? 430 : 1280;
const height = isMobile ? 780 : 800;

window.__game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width,
  height,
  backgroundColor: COLORS.appBg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, DashboardScene],
});
