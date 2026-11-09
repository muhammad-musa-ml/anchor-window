// mulberry32: a small seeded generator, so a seed gives the same page and the
// same scroll steps every time. In the simulation (bench/run.mjs) only the
// layout timings differ between runs.
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function intBetween(next, lo, hi) {
  return lo + Math.floor(next() * (hi - lo + 1));
}
