import Phaser from 'phaser';
import { COLORS, FONT } from '../theme.js';

const LINES = [
  'Connecting to legacy ticketing platform...',
  'Authenticating with expired certificate...',
  'Reticulating SLA timers...',
  'Warning client of unscheduled maintenance...',
  'Loading 40 dashboard widgets nobody asked for...',
];

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(COLORS.navBg);

    this.add.text(width / 2, height / 2 - 70, 'TixFlow Pro', {
      fontFamily: FONT, fontSize: '36px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 - 34, 'MSP Edition', {
      fontFamily: FONT, fontSize: '14px', color: '#8fa3c9',
    }).setOrigin(0.5);

    const line = this.add.text(width / 2, height / 2 + 20, LINES[0], {
      fontFamily: FONT, fontSize: '13px', color: '#c9d4e6',
    }).setOrigin(0.5);

    const barW = 300, barH = 8;
    const track = this.add.rectangle(width / 2, height / 2 + 55, barW, barH, 0x2a3a5c).setOrigin(0.5);
    const fill = this.add.rectangle(width / 2 - barW / 2, height / 2 + 55, 0, barH, 0x2f6fed).setOrigin(0, 0.5);

    let i = 0;
    const step = () => {
      i++;
      if (i < LINES.length) line.setText(LINES[i]);
      fill.width = Math.min(barW, (i / LINES.length) * barW);
    };
    this.time.addEvent({ delay: 260, repeat: LINES.length - 1, callback: step });

    this.time.delayedCall(260 * LINES.length + 200, () => this.scene.start('Dashboard'));
    this.input.once('pointerdown', () => this.scene.start('Dashboard'));
  }
}
