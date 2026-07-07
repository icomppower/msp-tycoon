// Ticket prioritization + auto-assignment. Manual assignment uses the same
// scoring so the UI can show a suggested queue order; hiring a Dispatcher
// turns autoAssign on every tick (and auto-triages — that's their whole job).

import { SEVERITY } from './constants.js';
import { effectiveSkill, effectiveCapacity } from './tickets.js';

// Higher = handle first. Uses actual severity once triaged, claimed otherwise
// — an untriaged fake P1 wastes your best tech's time. Triage is the counter.
export function ticketPriority(state, ticket) {
  const sev = ticket.triaged ? ticket.actualSeverity : ticket.severity;
  const sevScore = (5 - sev) * 10; // P1 → 40 … P4 → 10
  const ticksLeft = ticket.slaDeadline - state.tick;
  const urgency = ticket.breached ? 15 : Math.max(0, 12 - ticksLeft);
  const client = state.clients.find((c) => c.id === ticket.clientId);
  const fragile = client && client.patience < 40 ? 8 : 0;
  return sevScore + urgency + fragile;
}

export function hasDispatcher(state) {
  return state.techs.some((t) => t.role === 'dispatcher');
}

// Greedy: tickets in priority order, each to the free tech with the best
// skill for its type (lightly penalizing already-loaded techs).
export function autoAssign(state) {
  const load = {};
  const free = {};
  for (const tech of state.techs) {
    load[tech.id] = state.tickets.filter((t) => t.assignedTo === tech.id).length;
    free[tech.id] = effectiveCapacity(state, tech) - load[tech.id];
  }

  const unassigned = state.tickets
    .filter((t) => !t.assignedTo)
    .sort((a, b) => ticketPriority(state, b) - ticketPriority(state, a));

  for (const ticket of unassigned) {
    ticket.triaged = true; // dispatcher triages as they route
    let best = null;
    let bestScore = -Infinity;
    for (const tech of state.techs) {
      if (free[tech.id] <= 0) continue;
      const score = effectiveSkill(state, tech, ticket.type) - load[tech.id] * 0.4;
      if (score > bestScore) { bestScore = score; best = tech; }
    }
    if (!best) break; // everyone is full; remaining tickets wait
    ticket.assignedTo = best.id;
    free[best.id]--;
    load[best.id]++;
  }
}
