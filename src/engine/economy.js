// Money in, money out, and the fail state.

import { chance } from './rng.js';
import { TIME, ECONOMY, TECHS } from './constants.js';
import { UPGRADES } from './upgrades.js';
import { mrrPerMonth, log } from './state.js';
import { GAME_OVER_COPY } from './content.js';

export function hourlyEconomy(state) {
  const mrrTick = mrrPerMonth(state) / TIME.TICKS_PER_MONTH;
  state.cash += mrrTick;
  state.counters.mrrRevenue += mrrTick;

  state.debtTicks = state.cash < 0 ? state.debtTicks + 1 : 0;
  if (state.debtTicks >= ECONOMY.FAIL_DEBT_TICKS && !state.gameOver) {
    state.gameOver = { reason: 'broke', tick: state.tick };
    log(state, GAME_OVER_COPY.broke, 'gameover');
  }
}

export function weeklyUpkeep(state) {
  return state.upgrades.reduce((sum, id) => sum + (UPGRADES[id].upkeepWeek || 0), 0) * state.vendorMult;
}

export function weeklyExpenses(state) {
  const salaries = state.techs.reduce((sum, t) => sum + t.salaryWeek, 0);
  const rent = ECONOMY.RENT_BASE_WEEK + ECONOMY.RENT_PER_TECH_WEEK * (state.techs.length - 1);
  return { salaries, rent, tools: weeklyUpkeep(state) };
}

export function weeklyEconomy(state) {
  const { salaries, rent, tools } = weeklyExpenses(state);
  const total = salaries + rent + tools;
  state.cash -= total;
  log(state, `payroll week: −$${Math.round(total)} (salaries $${salaries}, rent $${rent}, tools $${Math.round(tools)})`, 'money');

  // Morale-driven quits (the player can't quit — it's your company).
  const quitters = state.techs.filter(
    (t) => t.id !== 'you' && t.morale < TECHS.MORALE_QUIT_THRESHOLD && chance(state, TECHS.MORALE_QUIT_PROB));
  for (const tech of quitters) {
    state.techs = state.techs.filter((t) => t.id !== tech.id);
    for (const ticket of state.tickets) if (ticket.assignedTo === tech.id) ticket.assignedTo = null;
    state.counters.quit++;
    log(state, `${tech.name} quit. The exit interview was just a long sigh.`, 'bad');
  }
}
