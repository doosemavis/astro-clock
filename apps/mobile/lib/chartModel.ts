// Pure view-model glue for the living chart: playback paces, mode→instant resolution.
// No engine *values* are imported (only the erased BirthData type), so this module is
// unit-testable under the strip-types runner. Readout formatting lives in ./readout.ts.
// Ported from apps/web/components/Chart/chartModel.ts (Compare + theme helpers removed).
import type { BirthData } from "@astro/engine";

export type Mode = "birth" | "now" | "moment" | "range" | "compare";
export type TimeFormat = "12h" | "24h";

/** App color theme: light, dark, or auto (day/night by the Sun at the displayed moment). */
export type ThemeMode = "light" | "dark" | "auto";

/** Mobile Compare presentation: both wheels stacked ("both"), a full-size horizontal
 *  swipe pager ("pages"), or a single full-size wheel that coin-flips between charts ("flip"). */
export type CompareView = "both" | "pages" | "flip";
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

/** Current page from a horizontal scroll offset — drives the Compare "Page" pager's dots.
 *  Rounds to the nearest page and clamps into [0, count-1]; degenerate inputs → 0. */
export function pageIndex(offsetX: number, pageWidth: number, count: number): number {
  if (pageWidth <= 0 || count <= 0) return 0;
  const i = Math.round(offsetX / pageWidth);
  return Math.max(0, Math.min(count - 1, i));
}
