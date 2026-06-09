// Pure degree-based astrology readouts derived from an ecliptic longitude (0..360).
// Same source of truth as the wheel, so panel readouts match the chart by construction.
import { SIGNS, PLANET_KEYS, type PlanetKey, type Sign, type Positions } from "./types.ts";
import { signOf, degInSign } from "./chart.ts";

const norm = (lon: number): number => ((lon % 360) + 360) % 360;

// Hellenistic "faces" / Chaldean decans: a 7-planet cycle beginning at Aries 1st decan = Mars.
const FACE_ORDER: PlanetKey[] = ["mars", "sun", "venus", "mercury", "moon", "saturn", "jupiter"];

/** Which 10-degree decan of the sign (1/2/3) and its Hellenistic-face ruler. */
export function decanOf(lon: number): { decan: 1 | 2 | 3; ruler: PlanetKey } {
  const d = norm(lon);
  const decan = (Math.floor(degInSign(d) / 10) + 1) as 1 | 2 | 3;
  const ruler = FACE_ORDER[Math.floor(d / 10) % 7];
  return { decan, ruler };
}

/** On-cusp info when within `orbDeg` of a sign boundary, else null. */
export function cuspOf(
  lon: number,
  orbDeg = 1,
): { onCusp: boolean; from: Sign; to: Sign } | null {
  const d = degInSign(lon);
  const sign = signOf(lon) as Sign;
  const idx = SIGNS.indexOf(sign);
  if (d < orbDeg) return { onCusp: true, from: SIGNS[(idx + 11) % 12], to: sign };
  if (d > 30 - orbDeg) return { onCusp: true, from: sign, to: SIGNS[(idx + 1) % 12] };
  return null;
}

/** True when the body is in the final (anaretic) degree, [29, 30). */
export function isAnaretic(lon: number): boolean {
  const d = degInSign(lon);
  return d >= 29 && d < 30;
}

/** Whole-sign house (1..12) of an ecliptic longitude given the ascendant longitude. */
export function houseOf(planetLon: number, ascLon: number): number {
  const ascSign = Math.floor(norm(ascLon) / 30);
  const bodySign = Math.floor(norm(planetLon) / 30);
  return ((bodySign - ascSign + 12) % 12) + 1;
}

/** Whole-sign house for every body, keyed by planet. */
export function wholeSignHouses(pos: Positions, ascLon: number): Record<PlanetKey, number> {
  const out = {} as Record<PlanetKey, number>;
  for (const k of PLANET_KEYS) out[k] = houseOf(pos[k], ascLon);
  return out;
}
