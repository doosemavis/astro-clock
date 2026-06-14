// Chart geometry + formatting. Ported from the prototype's P/signName/degInSign/
// fmtDMS/declutter. Pure; the React SVG layer consumes these.
import type { Positions, PlanetKey, Sign } from "./types.ts";
import { PLANET_KEYS, SIGNS } from "./types.ts";

const rev = (x: number) => ((x % 360) + 360) % 360;

/** Wheel radii — identical to the prototype's R object. */
export const R = {
  outer: 472, signInner: 404, signLabel: 438,
  natalGlyph: 373, natalTick: 394, liveRing: 330, liveGlyph: 330, aspect: 314,
} as const;

export const CX = 500;
export const CY = 500;

export function signOf(lon: number): Sign {
  return SIGNS[Math.floor(rev(lon) / 30)];
}

export function degInSign(lon: number): number {
  return rev(lon) % 30;
}

/** "19° Leo 36'" — rounds in arcminutes so 29°60' rolls into the next sign (prototype fmtDMS). */
export function formatDMS(lon: number): string {
  const totalMin = Math.round(rev(lon) * 60);
  const sign = Math.floor(totalMin / 1800) % 12;
  const within = totalMin - Math.floor(totalMin / 1800) * 1800;
  const deg = Math.floor(within / 60);
  const min = within % 60;
  return `${deg}° ${SIGNS[sign]} ${String(min).padStart(2, "0")}'`;
}

/** Polar projection — prototype P(): screen angle = (lon - 45), up = +y. */
export function polar(r: number, lon: number, cx = CX, cy = CY): [number, number] {
  const a = (lon - 45) * (Math.PI / 180);
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

/** Fan out tightly-clustered glyphs around each cluster's mean (prototype declutter, gap=8). */
export function declutter(pos: Positions, gap = 8): Record<PlanetKey, number> {
  const arr = PLANET_KEYS
    .map(key => ({ key, lon: rev(pos[key]) }))
    .sort((a, b) => a.lon - b.lon);
  const out = {} as Record<PlanetKey, number>;
  let i = 0;
  while (i < arr.length) {
    let j = i;
    while (j + 1 < arr.length && arr[j + 1].lon - arr[j].lon < gap) j++;
    const n = j - i + 1;
    if (n === 1) {
      out[arr[i].key] = arr[i].lon;
    } else {
      let mean = 0;
      for (let k = i; k <= j; k++) mean += arr[k].lon;
      mean /= n;
      const start = mean - (gap * (n - 1)) / 2;
      for (let k = i; k <= j; k++) out[arr[k].key] = rev(start + gap * (k - i));
    }
    i = j + 1;
  }
  return out;
}

/** SVG arc path for a curved sign label (prototype arcD). */
export function arcPath(r: number, lonFrom: number, lonTo: number, sweep: 0 | 1): string {
  const [ax, ay] = polar(r, lonFrom);
  const [bx, by] = polar(r, lonTo);
  return `M${ax.toFixed(2)} ${ay.toFixed(2)} A${r} ${r} 0 0 ${sweep} ${bx.toFixed(2)} ${by.toFixed(2)}`;
}
