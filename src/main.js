import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import DashboardScene from './scenes/DashboardScene.js';
import { COLORS } from './theme.js';

window.__game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 1280,
  height: 800,
  backgroundColor: COLORS.appBg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, DashboardScene],
});
