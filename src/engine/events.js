// Chaos events. Each event is data + an apply(). SIEM converts instant chaos
// into a scheduled pendingEvent the UI can show 24 ticks ahead.

import { chance, pick, weighted } from './rng.js';
import { CHAOS, STAGES } from './constants.js';
import { EVENT_COPY, PERSONALITIES } from './content.js';
import { getStat, hasFlag } from './modifiers.js';
import { makeTicket, makeProspect } from './entities.js';
import { churnClient, churnProb } from './clients.js';
import { log } from './state.js';

export const EVENTS = {
  isp_outage: {
    weight: 3, mild: false,
    apply(state) {
      // One ISP, one region — hits up to 8 clients, not the whole book.
      const hit = state.clients.slice(0, 8);
      for (const client of hit) {
        state.tickets.push(makeTicket(state, client, {
          type: 'network', actualSeverity: 1, claimedSeverity: 1,
          title: 'ISP OUTAGE — everything is down, yes everything',
        }));
      }
    },
  },
  phishing_ceo: {
    weight: 4, mild: false,
    apply(state) {
      if (!state.clients.length) return;
      if (!chance(state, getStat(state, 'self_inflict_mult', 1))) {
        log(state, 'A CEO almost clicked the link. Security awareness training held.', 'good');
        return;
      }
      const client = pick(state, state.clients);
      state.tickets.push(makeTicket(state, client, {
        type: 'security_incident', actualSeverity: 1, claimedSeverity: 1,
        title: `CEO clicked the link (${client.name})`,
      }));
    },
  },
  printer_uprising: {
    weight: 4, mild: true,
    apply(state) {
      state.activeEffects.push({
        id: 'printer_uprising',
        untilTick: state.tick + 24,
        mods: [{ stat: 'spawn_mult', op: 'mult', value: 1.6 }],
      });
      // A few printers declare independence immediately.
      const n = Math.min(state.clients.length, 3);
      for (let i = 0; i < n; i++) {
        state.tickets.push(makeTicket(state, pick(state, state.clients), { type: 'printer' }));
      }
    },
  },
  vendor_price_hike: {
    weight: 3, mild: true,
    apply(state) {
      state.vendorMult = Math.round(state.vendorMult * 1.1 * 100) / 100;
    },
  },
  referral: {
    weight: 2, mild: true,
    condition: (state) => state.reputation >= 55 && state.prospects.length < 3,
    apply(state) {
      const prospect = makeProspect(state, state.reputation >= 70 && hasFlag(state, 'vcio') ? 'managed_security' : 'managed');
      prospect.salesEffort = Math.round(prospect.salesEffort * 0.5); // warm lead
      state.prospects.push(prospect);
    },
  },
  poach: {
    weight: 3, mild: false,
    condition: (state) => state.stage >= STAGES.POACH_STAGE && state.clients.length > 1,
    apply(state) {
      const target = [...state.clients].sort((a, b) => a.patience - b.patience)[0];
      // The steak dinner works if they were already unhappy.
      if (chance(state, Math.max(0.15, churnProb(target.patience)))) {
        churnClient(state, target, 'poached');
      } else {
        log(state, `${target.name} took the competitor's meeting but stayed. This time.`, 'info');
      }
    },
  },
};

function eligibleEvents(state) {
  const mildOnly = state.stage < STAGES.CHAOS_STAGE;
  return Object.entries(EVENTS).filter(([id, e]) => {
    if (mildOnly && !e.mild) return false;
    if (e.condition && !e.condition(state)) return false;
    return true;
  });
}

export function tickEvents(state) {
  // Expire temporary effects.
  state.activeEffects = state.activeEffects.filter((e) => state.tick < e.untilTick);

  // Fire scheduled (SIEM-warned) events.
  const due = state.pendingEvents.filter((e) => state.tick >= e.fireTick);
  state.pendingEvents = state.pendingEvents.filter((e) => state.tick < e.fireTick);
  for (const pending of due) fireEvent(state, pending.eventId);

  // Roll for new chaos.
  if (state.stage < STAGES.MILD_CHAOS_STAGE) return;
  const rate = CHAOS.TICK_CHANCE * (state.stage < STAGES.CHAOS_STAGE ? CHAOS.MILD_FACTOR : 1);
  if (!chance(state, rate)) return;

  const pool = eligibleEvents(state);
  if (!pool.length) return;
  const eventId = weighted(state, pool.map(([id, e]) => [id, e.weight]));

  if (hasFlag(state, 'siem_warning')) {
    state.pendingEvents.push({ eventId, fireTick: state.tick + CHAOS.SIEM_WARNING_TICKS, warned: true });
    log(state, `SIEM alert: signs point to "${eventId.replace(/_/g, ' ')}" within 24 hours`, 'warn');
  } else {
    fireEvent(state, eventId);
  }
}

function fireEvent(state, eventId) {
  const event = EVENTS[eventId];
  if (!event) return;
  if (event.condition && !event.condition(state)) return; // world changed since the warning
  log(state, EVENT_COPY[eventId], 'event');
  event.apply(state);
}
