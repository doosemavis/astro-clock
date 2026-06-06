import {
  PLANET_KEYS, PLANET_GLYPH, SIGN_GLYPH, signOf, degInSign, decanOf, cuspOf, isAnaretic,
} from "@astro/engine";
import type { Positions, PlanetKey, Sign } from "@astro/engine";

export interface CoordinateRow {
  key: PlanetKey;
  glyph: string;          // planet glyph
  sign: Sign;
  signGlyph: string;
  dms: string;            // degree within sign, e.g. "0°29'"
  decan: 1 | 2 | 3;
  decanRuler: PlanetKey;
  decanRulerGlyph: string;
  anaretic: boolean;
  cusp: { from: Sign; to: Sign } | null;
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
    const { decan, ruler } = decanOf(lon);
    const cuspHit = cuspOf(lon);
    return {
      key,
      glyph: PLANET_GLYPH[key],
      sign,
      signGlyph: SIGN_GLYPH[sign],
      dms: fmtDeg(lon),
      decan,
      decanRuler: ruler,
      decanRulerGlyph: PLANET_GLYPH[ruler],
      anaretic: isAnaretic(lon),
      cusp: cuspHit ? { from: cuspHit.from, to: cuspHit.to } : null,
    };
  });
}
