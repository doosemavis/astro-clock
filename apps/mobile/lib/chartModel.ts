// Pure view-model glue for the living chart: playback paces, mode→instant resolution.
// No engine *values* are imported (only the erased BirthData type), so this module is
// unit-testable under the strip-types runner. Readout formatting lives in ./readout.ts.
// Ported from apps/web/components/Chart/chartModel.ts (Compare + theme helpers removed).
import type { BirthData, PlanetKey } from "@astro/engine";

export type Mode = "birth" | "now" | "moment" | "range" | "compare";
export type TimeFormat = "12h" | "24h";

/** App color theme: light, dark, or system (follows the OS light/dark setting). */
export type ThemeMode = "light" | "dark" | "system";

/** Mobile Compare presentation: both wheels stacked ("both"), a full-size horizontal
 *  swipe pager ("pages"), or a single full-size wheel that coin-flips between charts ("flip"). */
export type CompareView = "both" | "pages" | "flip";

/** A Compare chart's moment: wall-clock date/time interpreted in an IANA zone. */
export interface CompareMoment { date: string; time: string; zone: string; }
export interface Pace {
  label: string;
  rate: number; // sim-time ms advanced per real second
  note: string;
}

export const HR = 3600 * 1000;
export const DY = 24 * HR;

/** Range playback speeds — fast = ~1 month/sec, scaled down (prototype PACES). */
export const PACES: Pace[] = [
  { label: "Xtra-slow", rate: 1 * HR, note: "≈ 1 hour / sec" },
  { label: "Slow", rate: 6 * HR, note: "≈ 6 hours / sec" },
  { label: "Medium", rate: 12 * HR, note: "≈ 12 hours / sec" },
  { label: "Medium-fast", rate: 1 * DY, note: "≈ 1 day / sec" },
  { label: "Fast", rate: 7 * DY, note: "≈ 1 week / sec" },
  { label: "Xtra-fast", rate: 30 * DY, note: "≈ 1 month / sec" },
];

/** Standard offset + daylight-saving hour (prototype actualOff). */
export const actualOffset = (b: BirthData): number => b.tzOffset + (b.isDst ? 1 : 0);

/**
 * Resolve the moment the moveable glyphs should show, given the current mode.
 * Birth = the fixed UTC instant; Now = real time; Moment = a picked instant;
 * Range = linear interpolation across [start,end] by pos (0..1).
 */
export function resolveDate(
  mode: Mode, birthMs: number, momentMs: number,
  rangeStart: number, rangeEnd: number, pos: number,
): Date {
  if (mode === "birth") return new Date(birthMs);
  if (mode === "now") return new Date();
  if (mode === "moment") return new Date(momentMs);
  return new Date(rangeStart + pos * (rangeEnd - rangeStart));
}

/** Which glyph layer a visibility toggle targets: the fixed birth ring or the moving ring. */
export type Layer = "natal" | "live";
/** Per-planet show/hide flags for one ring. */
export type VisMap = Record<PlanetKey, boolean>;
/** Visibility for both rings (mirrors the web `Vis`). */
export interface Vis { natal: VisMap; live: VisMap; }

/** A visibility map with every given planet shown. */
export function allVisible(keys: PlanetKey[]): VisMap {
  const m = {} as VisMap;
  keys.forEach((k) => { m[k] = true; });
  return m;
}

/** Immutable per-planet/per-layer toggle. `key === "all"` flips the whole layer to the
 *  opposite of "is every key currently on". Never mutates the input. */
export function toggleVis(vis: Vis, key: PlanetKey | "all", layer: Layer): Vis {
  const map = vis[layer];
  if (key === "all") {
    const allOn = Object.values(map).every(Boolean);
    const next = {} as VisMap;
    (Object.keys(map) as PlanetKey[]).forEach((k) => { next[k] = !allOn; });
    return { ...vis, [layer]: next };
  }
  return { ...vis, [layer]: { ...map, [key]: !map[key] } };
}

/** Current page from a horizontal scroll offset — drives the Compare "Page" pager's dots.
 *  Rounds to the nearest page and clamps into [0, count-1]; degenerate inputs → 0. */
export function pageIndex(offsetX: number, pageWidth: number, count: number): number {
  if (pageWidth <= 0 || count <= 0) return 0;
  const i = Math.round(offsetX / pageWidth);
  return Math.max(0, Math.min(count - 1, i));
}
