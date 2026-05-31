// Aspect definitions + detection. Ported verbatim from the prototype's ASPECTS array
// (angles, orbs, tiers, the dark/light two-shade colors, dash, opacity, width).
import type { AspectDef, AspectHit, Positions, PlanetKey } from "./types.ts";
import { PLANET_KEYS } from "./types.ts";

const rev = (x: number) => ((x % 360) + 360) % 360;

export const ASPECT_DEFS: AspectDef[] = [
  // major (Ptolemaic) — solid, bold
  { angle: 60, orb: 4, tier: "major", name: "sextile", dark: "#7aa6ff", light: "#1f4fc4", dash: "11 7", opacity: 0.92, width: 3 },
  { angle: 90, orb: 6, tier: "major", name: "square", dark: "#ff5d66", light: "#c01e28", dash: "", opacity: 0.92, width: 3 },
  { angle: 120, orb: 6, tier: "major", name: "trine", dark: "#26d196", light: "#0a7a52", dash: "", opacity: 0.92, width: 3 },
  { angle: 180, orb: 7, tier: "major", name: "opposition", dark: "#ff5d66", light: "#c01e28", dash: "", opacity: 0.92, width: 3 },
  // minor — thin & dotted
  { angle: 30, orb: 2, tier: "minor", name: "semisextile", dark: "#2bd4a8", light: "#08906e", dash: "2 5", opacity: 0.92, width: 2 },
  { angle: 45, orb: 2, tier: "minor", name: "semisquare", dark: "#ff9d4d", light: "#c25e0e", dash: "2 5", opacity: 0.92, width: 2 },
  { angle: 72, orb: 2, tier: "minor", name: "quintile", dark: "#b98cff", light: "#5a2cc0", dash: "2 5", opacity: 0.92, width: 2 },
  { angle: 135, orb: 2, tier: "minor", name: "sesquiquadrate", dark: "#ff9d4d", light: "#c25e0e", dash: "2 5", opacity: 0.92, width: 2 },
  { angle: 150, orb: 3, tier: "minor", name: "quincunx", dark: "#ff6fae", light: "#c41f6e", dash: "2 5", opacity: 0.92, width: 2 },
];

/** Angular separation (0..180) between two ecliptic longitudes. */
export function separation(a: number, b: number): number {
  let d = Math.abs(rev(a) - rev(b)) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/** First matching aspect for a pair of longitudes, or null (prototype aspectBetween). */
export function aspectBetween(a: number, b: number): AspectDef | null {
  const d = separation(a, b);
  for (const def of ASPECT_DEFS) {
    if (Math.abs(d - def.angle) <= def.orb) return def;
  }
  return null;
}

/** All aspect hits among a set of positions, filtered by tier (drives drawAspects). */
export function findAspects(
  pos: Positions,
  opts: { major?: boolean; minor?: boolean } = { major: true, minor: true },
): AspectHit[] {
  const hits: AspectHit[] = [];
  for (let i = 0; i < PLANET_KEYS.length; i++) {
    for (let j = i + 1; j < PLANET_KEYS.length; j++) {
      const a = PLANET_KEYS[i] as PlanetKey;
      const b = PLANET_KEYS[j] as PlanetKey;
      const d = separation(pos[a], pos[b]);
      for (const def of ASPECT_DEFS) {
        if (def.tier === "major" && opts.major === false) continue;
        if (def.tier === "minor" && opts.minor === false) continue;
        if (Math.abs(d - def.angle) <= def.orb) {
          hits.push({ a, b, def, delta: Math.abs(d - def.angle) });
          break;
        }
      }
    }
  }
  return hits;
}
