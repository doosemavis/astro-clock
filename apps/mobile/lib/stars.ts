export interface Star { cx: number; cy: number; r: number; o: number; }

/** Deterministic PRNG (ported from the web Starfield) — no Math.random, so the scatter is
 *  identical on every platform/render. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fixed scatter of stars in a 0..100 box (cx/cy as %, small radii, varied opacity). */
export function makeStars(count: number, seed: number): Star[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    cx: +(rnd() * 100).toFixed(2),
    cy: +(rnd() * 100).toFixed(2),
    r: +(0.04 + rnd() * 0.13).toFixed(3),
    o: +(0.25 + rnd() * 0.7).toFixed(2),
  }));
}
