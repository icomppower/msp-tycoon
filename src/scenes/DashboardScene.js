import Phaser from 'phaser';
import {
  createGame, tick, actions, selectors, serialize, deserialize,
  UPGRADES, canBuy, TECHS, PERSONALITIES, hasDispatcher,
} from '../engine/index.js';
import { GAME_OVER_COPY } from '../engine/content.js';
import {
  COLORS, FONT, SEVERITY_COLOR, SEVERITY_LABEL, TIER_LABEL, TIER_COLOR,
  LOG_COLOR, patienceColor, moraleColor, slaColor,
} from '../theme.js';
import { panel, button, progressBar, label, badge, divider } from '../ui/widgets.js';
import { openModal, closeModal } from '../ui/Modal.js';

const SAVE_KEY = 'msp-tycoon-save';
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TREES = [
  { key: 'rmm', label: 'RMM' },
  { key: 'security', label: 'Security' },
  { key: 'business', label: 'Business' },
];

function truncate(str, n) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

export default class DashboardScene extends Phaser.Scene {
  constructor() {
    super('Dashboard');
  }

  create() {
    this.cameras.main.setBackgroundColor(COLORS.appBg);
    this.activeTree = 'rmm';
    this.speed = 1;
    this.paused = false;
    this.activeModal = null;
    this.dyn = {};

    this.loadedFromSave = this.loadState();
    if (this.loadedFromSave) this.paused = true; // resume paused, per design

    this.buildStaticLayout();
    this.applyTickRate();
    this.setupPersistence();
    this.refresh();

    if (this.state.gameOver) this.showGameOver();
  }

  // ─── persistence ────────────────────────────────────────────

  loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { this.state = deserialize(raw); return true; }
    } catch (e) { /* corrupt save, start fresh */ }
    this.state = createGame(Date.now() & 0xffffffff);
    return false;
  }

  save() {
    try { localStorage.setItem(SAVE_KEY, serialize(this.state)); } catch (e) { /* storage full/unavailable */ }
  }

  setupPersistence() {
    this.autosave = setInterval(() => this.save(), 8000);
    this._onHide = () => { if (document.visibilityState === 'hidden') this.save(); };
    this._onUnload = () => this.save();
    document.addEventListener('visibilitychange', this._onHide);
    window.addEventListener('beforeunload', this._onUnload);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearInterval(this.autosave);
      document.removeEventListener('visibilitychange', this._onHide);
      window.removeEventListener('beforeunload', this._onUnload);
      if (this.tickTimer) this.tickTimer.remove();
    });
  }

  newGame() {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

  // ─── tick loop ──────────────────────────────────────────────

  applyTickRate() {
    if (this.tickTimer) { this.tickTimer.remove(); this.tickTimer = null; }
    if (this.paused || this.state.gameOver) return;
    this.tickTimer = this.time.addEvent({
      delay: 1000 / this.speed, loop: true, callback: () => this.onTick(),
    });
  }

  onTick() {
    tick(this.state);
    this.refresh();
    if (this.state.gameOver) {
      this.applyTickRate();
      this.save();
      this.showGameOver();
    }
  }

  setSpeed(mult) {
    this.speed = mult;
    this.paused = false;
    this.applyTickRate();
    this.refresh();
  }

  togglePause() {
    this.paused = !this.paused;
    this.applyTickRate();
    this.refresh();
  }

  // ─── static layout (built once) ─────────────────────────────

  buildStaticLayout() {
    // top bar
    this.add.rectangle(0, 0, 1280, 50, COLORS.navBg).setOrigin(0);
    this.add.text(14, 25, '🎫 TixFlow Pro', {
      fontFamily: FONT, fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.dyn.topBarStats = this.add.container(150, 0);
    this.dyn.topBarControls = this.add.container(0, 0);

    // panels
    this.panels = {
      queue: panel(this, 10, 60, 430, 730, 'Ticket Queue'),
      clients: panel(this, 450, 60, 390, 270, 'Client Health'),
      staff: panel(this, 450, 340, 390, 450, 'Staff'),
      sales: panel(this, 850, 60, 420, 200, 'Sales Pipeline'),
      upgrades: panel(this, 850, 270, 420, 290, 'Upgrade Store'),
      log: panel(this, 850, 570, 420, 220, 'Activity Log'),
    };

    // upgrade store tabs (static, switching just re-renders the list)
    const up = this.panels.upgrades;
    this.dyn.upgradeTabs = this.add.container(850 + 8, 270 + 34);
    TREES.forEach((t, i) => {
      const btn = button(this, i * 128, 0, 120, 24, t.label, {
        tone: this.activeTree === t.key ? 'accent' : 'muted',
        onClick: () => { this.activeTree = t.key; this.renderUpgrades(); this.renderUpgradeTabs(); },
      });
      btn.name = t.key;
      this.dyn.upgradeTabs.add(btn);
    });
  }

  renderUpgradeTabs() {
    this.dyn.upgradeTabs.list.forEach((btn) => {
      const bg = btn.list[0];
      bg.setFillStyle(btn.name === this.activeTree ? COLORS.accent : 0xdfe4ea);
    });
  }

  // ─── full refresh (called after every tick and every action) ─

  refresh() {
    this.renderTopBar();
    this.renderQueue();
    this.renderClients();
    this.renderStaff();
    this.renderSales();
    this.renderUpgrades();
    this.renderLog();
  }

  // ─── top bar ────────────────────────────────────────────────

  renderTopBar() {
    this.dyn.topBarStats.removeAll(true);
    this.dyn.topBarControls.removeAll(true);
    const s = this.state;
    const { day, hour, week } = selectors.clock(s);
    const mrr = Math.round(selectors.mrrPerMonth(s));
    const stageNames = ['', 'Garage', 'First Hire', 'Real MSP', 'Regional'];

    const stats = [
      `Cash $${Math.round(s.cash).toLocaleString()}`,
      `MRR $${mrr.toLocaleString()}/mo`,
      `Rep ${Math.round(s.reputation)}`,
      `Wk${week} ${DAY_NAMES[day]} ${String(hour).padStart(2, '0')}:00`,
      `Stage ${s.stage}: ${stageNames[s.stage]}`,
    ];
    let x = 0;
    for (const t of stats) {
      const txt = this.add.text(x, 25, t, { fontFamily: FONT, fontSize: '13px', color: '#dfe6f5' }).setOrigin(0, 0.5);
      this.dyn.topBarStats.add(txt);
      x += txt.width + 26;
    }

    let cx = 1280 - 14;
    const sellEnabled = s.stage >= 4 && !s.gameOver;
    const sellBtn = button(this, 0, 13, 90, 26, 'Sell MSP', {
      tone: 'good', enabled: sellEnabled, onClick: () => this.confirmSell(),
    });
    cx -= 90; sellBtn.x = cx; cx -= 12;
    this.dyn.topBarControls.add(sellBtn);

    [4, 2, 1].forEach((m) => {
      const btn = button(this, 0, 13, 34, 26, `${m}x`, {
        tone: (!this.paused && this.speed === m) ? 'accent' : 'muted',
        onClick: () => this.setSpeed(m),
      });
      cx -= 34; btn.x = cx; cx -= 6;
      this.dyn.topBarControls.add(btn);
    });
    const pauseBtn = button(this, 0, 13, 60, 26, this.paused ? '▶ Play' : '⏸ Pause', {
      tone: this.paused ? 'good' : 'muted', onClick: () => this.togglePause(),
    });
    cx -= 60; pauseBtn.x = cx;
    this.dyn.topBarControls.add(pauseBtn);
  }

  confirmSell() {
    openModal(this, {
      title: 'Sell the MSP?', width: 360, height: 160,
      build: (box, w) => {
        box.add(label(this, 16, 50, 'This ends the run. Valuation is based on\ncash + annualized MRR, scaled by reputation.', { fontSize: '12px', color: COLORS.textMuted }));
        box.add(button(this, w - 180, 110, 80, 30, 'Cancel', { tone: 'muted', onClick: () => closeModal(this) }));
        box.add(button(this, w - 92, 110, 80, 30, 'Sell', {
          tone: 'good', onClick: () => { actions.sellMSP(this.state); closeModal(this); this.save(); this.refresh(); this.showGameOver(); },
        }));
      },
    });
  }

  // ─── ticket queue ───────────────────────────────────────────

  renderQueue() {
    this.dyn.queueList?.destroy();
    const c = this.add.container(8, 38); // local to the panel container it's added to below
    this.dyn.queueList = c;
    this.panels.queue.add(c);

    const list = selectors.queue(this.state);
    const dispatcherRunning = hasDispatcher(this.state);
    const rowH = 40, maxRows = 16;
    const visible = list.slice(0, maxRows);

    if (!list.length) {
      c.add(label(this, 0, 4, 'No open tickets. Enjoy it while it lasts.', { color: COLORS.textMuted }));
    }

    visible.forEach((ticket, i) => {
      const y = i * rowH;
      if (i % 2 === 1) c.add(this.add.rectangle(-8, y, 414, rowH, COLORS.rowAlt).setOrigin(0));

      const client = this.state.clients.find((cl) => cl.id === ticket.clientId);
      const shownSeverity = ticket.triaged ? ticket.actualSeverity : ticket.severity;
      c.add(badge(this, 0, y + 3, SEVERITY_LABEL[shownSeverity], SEVERITY_COLOR[shownSeverity]));

      const title = truncate(ticket.title, 30);
      c.add(label(this, 42, y + 2, title, { fontSize: '11px' }));
      c.add(label(this, 42, y + 18, client ? client.name : '(unknown client)', { fontSize: '10px', color: COLORS.textFaint }));

      const ticksLeft = ticket.slaDeadline - this.state.tick;
      const slaText = ticket.breached ? 'BREACHED' : (ticksLeft <= 0 ? 'due now' : `${ticksLeft}h left`);
      c.add(label(this, 300, y + 2, slaText, { fontSize: '10px', color: `#${slaColor(ticksLeft, ticket.breached).toString(16).padStart(6, '0')}`, fontStyle: 'bold' }));

      if (dispatcherRunning) {
        c.add(label(this, 300, y + 18, 'auto-routed', { fontSize: '9px', color: COLORS.textFaint }));
      } else if (!ticket.triaged) {
        c.add(button(this, 300, y + 14, 62, 22, 'Triage', {
          fontSize: '10px', onClick: () => { actions.triageTicket(this.state, ticket.id); this.refresh(); },
        }));
      } else if (!ticket.assignedTo) {
        c.add(button(this, 300, y + 14, 62, 22, 'Assign', {
          fontSize: '10px', onClick: () => this.openAssignModal(ticket),
        }));
      } else {
        const tech = this.state.techs.find((t) => t.id === ticket.assignedTo);
        c.add(button(this, 300, y + 14, 100, 22, tech ? tech.name : '?', {
          fontSize: '10px', tone: 'muted',
          onClick: () => { actions.unassignTicket(this.state, ticket.id); this.refresh(); },
        }));
      }
    });

    if (list.length > maxRows) {
      c.add(label(this, 0, visible.length * rowH + 6, `+${list.length - maxRows} more in queue`, { color: COLORS.textMuted, fontSize: '11px' }));
    }
  }

  openAssignModal(ticket) {
    const workers = this.state.techs.filter((t) => t.role !== 'dispatcher');
    openModal(this, {
      title: `Assign: ${truncate(ticket.title, 34)}`, width: 380, height: Math.min(420, 70 + workers.length * 46),
      build: (box) => {
        workers.forEach((tech, i) => {
          const y = 44 + i * 46;
          const load = this.state.tickets.filter((t) => t.assignedTo === tech.id).length;
          const skill = tech.skills[ticket.type] ?? 1;
          box.add(this.add.rectangle(12, y, 356, 40, i % 2 ? COLORS.rowAlt : COLORS.panelBg).setOrigin(0));
          box.add(label(this, 20, y + 6, tech.name, { fontStyle: 'bold' }));
          box.add(label(this, 20, y + 22, `${tech.role} · skill ${skill} · load ${load}/${tech.capacity} · morale ${Math.round(tech.morale)}`, { fontSize: '10px', color: COLORS.textMuted }));
          box.add(button(this, 280, y + 8, 80, 24, 'Assign', {
            fontSize: '11px',
            onClick: () => { actions.assignTicket(this.state, ticket.id, tech.id); closeModal(this); this.refresh(); },
          }));
        });
        if (!workers.length) box.add(label(this, 16, 50, 'No techs available. Hire someone!', { color: COLORS.textMuted }));
      },
    });
  }

  // ─── client health ──────────────────────────────────────────

  renderClients() {
    this.dyn.clientList?.destroy();
    const c = this.add.container(8, 38);
    this.dyn.clientList = c;
    this.panels.clients.add(c);

    const list = selectors.clientHealth(this.state);
    const rowH = 34, maxRows = 6;
    const visible = list.slice(0, maxRows);

    visible.forEach((client, i) => {
      const y = i * rowH;
      if (i % 2 === 1) c.add(this.add.rectangle(-8, y, 374, rowH, COLORS.rowAlt).setOrigin(0));
      c.add(label(this, 0, y + 2, truncate(client.name, 20), { fontSize: '11px', fontStyle: 'bold' }));
      c.add(badge(this, 0, y + 17, TIER_LABEL[client.tier], TIER_COLOR[client.tier]));
      const persona = PERSONALITIES[client.personality];
      if (persona.blurb) c.add(label(this, 66, y + 18, persona.blurb, { fontSize: '9px', color: COLORS.textFaint }));

      c.add(progressBar(this, 230, y + 6, 100, 10, client.patience / 100, patienceColor(client.patience)));
      c.add(label(this, 335, y + 2, `${Math.round(client.patience)}`, { fontSize: '10px' }));
      c.add(label(this, 230, y + 18, `${client.size} seats`, { fontSize: '9px', color: COLORS.textFaint }));
    });

    if (!list.length) c.add(label(this, 0, 4, 'No clients yet.', { color: COLORS.textMuted }));
    if (list.length > maxRows) {
      c.add(label(this, 0, visible.length * rowH + 4, `+${list.length - maxRows} more clients`, { color: COLORS.textMuted, fontSize: '11px' }));
    }
  }

  // ─── staff ──────────────────────────────────────────────────

  renderStaff() {
    this.dyn.staffList?.destroy();
    const c = this.add.container(8, 38);
    this.dyn.staffList = c;
    this.panels.staff.add(c);

    const rowH = 34, maxRows = 8;
    const techs = this.state.techs;
    const visible = techs.slice(0, maxRows);

    visible.forEach((tech, i) => {
      const y = i * rowH;
      if (i % 2 === 1) c.add(this.add.rectangle(-8, y, 374, rowH, COLORS.rowAlt).setOrigin(0));
      const load = this.state.tickets.filter((t) => t.assignedTo === tech.id).length;
      c.add(label(this, 0, y + 2, `${tech.name}`, { fontSize: '11px', fontStyle: 'bold' }));
      c.add(label(this, 0, y + 17, tech.role === 'owner' ? 'you' : tech.role, { fontSize: '9px', color: COLORS.textFaint }));
      if (tech.capacity > 0) c.add(label(this, 100, y + 17, `load ${load}/${tech.capacity}`, { fontSize: '9px', color: COLORS.textFaint }));

      c.add(progressBar(this, 190, y + 6, 90, 10, tech.morale / 100, moraleColor(tech.morale)));
      c.add(label(this, 285, y + 2, `${Math.round(tech.morale)}`, { fontSize: '10px' }));

      if (tech.id !== 'you') {
        c.add(button(this, 285, y + 15, 89, 18, 'Let go', {
          fontSize: '9px', tone: 'bad',
          onClick: () => { actions.fireTech(this.state, tech.id); this.refresh(); },
        }));
      }
    });

    if (techs.length > maxRows) {
      c.add(label(this, 0, visible.length * rowH + 4, `+${techs.length - maxRows} more staff`, { color: COLORS.textMuted, fontSize: '11px' }));
    }

    // hire row, pinned near the bottom of the panel
    const hireY = 450 - 38 - 78;
    c.add(divider(this, -8, hireY - 6, 374));
    c.add(label(this, 0, hireY, 'Hire:', { fontSize: '11px', color: COLORS.textMuted }));
    const roles = ['junior', 'tech', 'senior', 'dispatcher'];
    roles.forEach((role, i) => {
      const def = TECHS.ROLES[role];
      const affordable = this.state.cash >= def.salaryWeek * 2; // rough sanity gate, not a hard rule
      const btn = button(this, i * 92, hireY + 18, 86, 40, `${role}\n$${def.salaryWeek}/wk`, {
        fontSize: '9px', enabled: affordable,
        onClick: () => { actions.hireTech(this.state, role); this.refresh(); },
      });
      // multi-line label tweak
      btn.list[1].setLineSpacing(2).setAlign('center').setPosition(43, 20);
      c.add(btn);
    });
  }

  // ─── sales pipeline ─────────────────────────────────────────

  renderSales() {
    this.dyn.salesList?.destroy();
    const c = this.add.container(8, 38);
    this.dyn.salesList = c;
    this.panels.sales.add(c);

    const rowH = 50;
    this.state.prospects.forEach((p, i) => {
      const y = i * rowH;
      if (i % 2 === 1) c.add(this.add.rectangle(-8, y, 404, rowH, COLORS.rowAlt).setOrigin(0));
      c.add(label(this, 0, y + 2, truncate(p.name, 22), { fontSize: '11px', fontStyle: 'bold' }));
      c.add(badge(this, 0, y + 17, TIER_LABEL[p.tier], TIER_COLOR[p.tier]));
      c.add(label(this, 66, y + 18, `${p.size} seats`, { fontSize: '9px', color: COLORS.textFaint }));

      c.add(progressBar(this, 200, y + 6, 110, 10, p.salesProgress / p.salesEffort, COLORS.accent));
      c.add(button(this, 320, y + 2, 76, 24, p.working ? 'Stop' : 'Work', {
        fontSize: '10px', tone: p.working ? 'muted' : 'accent',
        onClick: () => {
          if (p.working) actions.stopSales(this.state); else actions.workProspect(this.state, p.id);
          this.refresh();
        },
      }));
    });

    if (!this.state.prospects.length) c.add(label(this, 0, 4, 'No leads right now. Reputation attracts them.', { color: COLORS.textMuted, fontSize: '11px' }));
  }

  // ─── upgrade store ──────────────────────────────────────────

  renderUpgrades() {
    this.dyn.upgradeList?.destroy();
    const c = this.add.container(8, 66); // below the tree tabs, which sit at local y=34
    this.dyn.upgradeList = c;
    this.panels.upgrades.add(c);

    const ids = Object.keys(UPGRADES).filter((id) => UPGRADES[id].tree === this.activeTree)
      .sort((a, b) => UPGRADES[a].tier - UPGRADES[b].tier);

    const rowH = 54;
    ids.forEach((id, i) => {
      const up = UPGRADES[id];
      const y = i * rowH;
      if (i % 2 === 1) c.add(this.add.rectangle(-8, y, 404, rowH, COLORS.rowAlt).setOrigin(0));

      const owned = this.state.upgrades.includes(id);
      const check = canBuy(this.state, id);
      c.add(label(this, 0, y + 2, `T${up.tier} ${up.name}`, { fontSize: '11px', fontStyle: 'bold' }));
      c.add(label(this, 0, y + 18, truncate(up.blurb, 46), { fontSize: '9px', color: COLORS.textMuted }));
      c.add(label(this, 0, y + 32, `$${up.cost}${up.upkeepWeek ? ` + $${up.upkeepWeek}/wk` : ''}`, { fontSize: '9px', color: COLORS.textFaint }));

      let btnLabel = `$${up.cost}`;
      if (owned) btnLabel = 'Owned';
      else if (!check.ok) btnLabel = check.reason.length > 14 ? 'Locked' : check.reason;
      c.add(button(this, 320, y + 12, 76, 26, btnLabel, {
        fontSize: '10px', tone: owned ? 'muted' : 'good', enabled: !owned && check.ok,
        onClick: () => { actions.buyUpgrade(this.state, id); this.refresh(); },
      }));
    });
  }

  // ─── activity log ───────────────────────────────────────────

  renderLog() {
    this.dyn.logList?.destroy();
    const c = this.add.container(8, 38);
    this.dyn.logList = c;
    this.panels.log.add(c);

    const entries = [...this.state.log].reverse().slice(0, 11);
    entries.forEach((e, i) => {
      c.add(label(this, 0, i * 16, truncate(e.msg, 58), { fontSize: '10px', color: LOG_COLOR[e.kind] || COLORS.text }));
    });
    if (!entries.length) c.add(label(this, 0, 0, 'Nothing has happened yet.', { color: COLORS.textMuted, fontSize: '11px' }));
  }

  // ─── game over ──────────────────────────────────────────────

  showGameOver() {
    const s = this.state;
    const copy = GAME_OVER_COPY[s.gameOver.reason];
    openModal(this, {
      title: s.gameOver.reason === 'sold' ? 'Exit achieved' : 'Game over', width: 480, height: 280,
      build: (box, w) => {
        box.add(label(this, 16, 50, copy, { fontSize: '12px', color: COLORS.textMuted, wordWrap: { width: w - 32 } }));
        const stats = [
          `Weeks in business: ${Math.floor(s.tick / 168)}`,
          `Clients at end: ${s.clients.length}`,
          `Tickets resolved: ${s.counters.resolved}`,
          `Reputation: ${Math.round(s.reputation)}`,
        ];
        if (s.gameOver.score != null) stats.push(`Sale valuation: $${s.gameOver.score.toLocaleString()}`);
        box.add(label(this, 16, 130, stats.join('\n'), { fontSize: '12px', lineSpacing: 6 }));
        box.add(button(this, w - 132, 232, 116, 32, 'New Game', { tone: 'accent', onClick: () => this.newGame() }));
      },
    });
  }
}
