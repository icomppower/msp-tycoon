// Deterministic PRNG (mulberry32). All randomness flows through state.rng so a
// serialized game replays identically — required for the balance harness and
// for any future offline/idle fast-forward.

export function rand(state) {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function chance(state, p) {
  return rand(state) < p;
}

export function randInt(state, min, max) {
  return min + Math.floor(rand(state) * (max - min + 1));
}

export function pick(state, arr) {
  return arr[Math.floor(rand(state) * arr.length)];
}

// entries: [[value, weight], ...]
export function weighted(state, entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand(state) * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}
