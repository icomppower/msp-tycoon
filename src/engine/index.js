// MSP Tycoon engine — public API surface for the UI layer.

export { createGame, tick, actions, selectors } from './sim.js';
export { serialize, deserialize, clock, mrrPerMonth } from './state.js';
export { UPGRADES, canBuy } from './upgrades.js';
export { TECHS, TIME, SEVERITY, CLIENTS, ECONOMY } from './constants.js';
export { TICKET_TYPES, PERSONALITIES, EVENT_COPY } from './content.js';
export { churnProb } from './clients.js';
export { ticketPriority, hasDispatcher } from './dispatcher.js';
export { getStat, hasFlag } from './modifiers.js';
