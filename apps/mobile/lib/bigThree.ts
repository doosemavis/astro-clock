import type { Mode } from "./chartModel.ts";

/** Header signature label. Ascendant ("↑") is shown only when an ascendant sign is given. */
export function bigThreeLabel(sun: string, moon: string, asc: string | null): string {
  const base = `☉ ${sun}   ☽ ${moon}`;
  return asc ? `${base}   ↑ ${asc}` : base;
}

/** Which instant the header big-three reflects. In Range mode it freezes at the range start
 *  while playing; otherwise (paused / reset / ended, and every other mode) it follows the
 *  displayed instant. */
export function bigThreeInstantMs(
  mode: Mode, playing: boolean, rangeStartMs: number, displayMs: number,
): number {
  return mode === "range" && playing ? rangeStartMs : displayMs;
}
