import { separation, PLANET_KEYS, type Positions, type PlanetKey } from "@astro/engine";
import { TRANSITING_BODIES, type TransitAspect } from "./keys.ts";

interface TransitDef { name: TransitAspect; angle: number; orb: number; }

/** Major aspects for forecasts (includes conjunction, which the wheel omits). */
export const TRANSIT_DEFS: TransitDef[] = [
  { name: "conjunction", angle: 0, orb: 8 },
  { name: "sextile", angle: 60, orb: 4 },
  { name: "square", angle: 90, orb: 6 },
  { name: "trine", angle: 120, orb: 6 },
  { name: "opposition", angle: 180, orb: 7 },
];

export interface TransitHit {
  transiting: PlanetKey;
  aspect: TransitAspect;
  natal: PlanetKey;
  delta: number; // degrees from exact
}

/** Cross-set: aspects from each transiting body to each natal body (first match wins). */
export function transitHits(transiting: Positions, natal: Positions): TransitHit[] {
  const hits: TransitHit[] = [];
  // Same-body pairs (e.g. transiting Sun vs natal Sun) yield a ~0° conjunction — this is
  // the solar/lunar "return" and is intentional, not a self-comparison bug.
  for (const t of TRANSITING_BODIES) {
    for (const n of PLANET_KEYS) {
      const d = separation(transiting[t], natal[n]);
      for (const def of TRANSIT_DEFS) {
        if (Math.abs(d - def.angle) <= def.orb) {
          hits.push({ transiting: t, aspect: def.name, natal: n, delta: Math.abs(d - def.angle) });
          break;
        }
      }
    }
  }
  return hits;
}
