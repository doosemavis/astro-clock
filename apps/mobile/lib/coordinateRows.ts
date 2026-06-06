import { PLANET_KEYS, PLANET_GLYPH, SIGN_GLYPH, signOf, degInSign } from "@astro/engine";
import type { Positions, PlanetKey, Sign } from "@astro/engine";

export interface CoordinateRow {
  key: PlanetKey;
  glyph: string;       // planet glyph
  sign: Sign;          // sign name (for accessibility)
  signGlyph: string;   // sign glyph
  dms: string;         // degree within sign, e.g. "0°29'"
}

/** Format the degree-within-sign as D°MM' (e.g. 0.4833 -> "0°29'"). */
function fmtDeg(lon: number): string {
  const dis = degInSign(lon);
  const deg = Math.floor(dis);
  const min = Math.floor((dis - deg) * 60);
  return `${deg}°${String(min).padStart(2, "0")}'`;
}

/** Display rows for every chart glyph (the 10 planets) from a Positions snapshot. */
export function buildCoordinateRows(positions: Positions): CoordinateRow[] {
  return PLANET_KEYS.map((key) => {
    const lon = positions[key];
    const sign = signOf(lon) as Sign;
    return {
      key,
      glyph: PLANET_GLYPH[key],
      sign,
      signGlyph: SIGN_GLYPH[sign],
      dms: fmtDeg(lon),
    };
  });
}
