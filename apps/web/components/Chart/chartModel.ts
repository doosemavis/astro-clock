// Pure, view-only helpers for the chart: playback paces, birth-instant timezone
// shifting, readout formatting, and <input type=datetime-local> <-> ms conversion.
// All astronomy/data lives in @astro/engine; this is presentation glue only.
import { tzAbbrev, formatOffset } from "@astro/engine";
import type { BirthData } from "@astro/engine";
import type { Mode, Pace, TimeFormat } from "./types";

export const HR = 3600 * 1000;
export const DY = 24 * HR;

/** Range playback speeds — fast = ~1 month/sec, scaled down from there (prototype PACES). */
export const PACES: Pace[] = [
  { label: "Xtra-slow", rate: 1 * HR, note: "≈ 1 hour / sec" },
  { label: "Slow", rate: 6 * HR, note: "≈ 6 hours / sec" },
  { label: "Medium", rate: 12 * HR, note: "≈ 12 hours / sec" },
  { label: "Medium-fast", rate: 1 * DY, note: "≈ 1 day / sec" },
  { label: "Fast", rate: 7 * DY, note: "≈ 1 week / sec" },
  { label: "Xtra-fast", rate: 30 * DY, note: "≈ 1 month / sec" },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Standard offset + daylight-saving hour (prototype actualOff). */
export const actualOffset = (b: BirthData): number => b.tzOffset + (b.isDst ? 1 : 0);

/**
 * Approximate the viewer's current location from their browser timezone, for the Now-view
 * Auto theme. Longitude ≈ (UTC offset hours) × 15°; latitude can't be derived from a zone,
 * so a mid-northern default is used — good enough for a day/night blend, which is driven
 * mostly by local solar time. (Exact day-length would require GPS.)
 */
export function localApproxLoc(): { lat: number; lon: number } {
  const offsetHours = -new Date().getTimezoneOffset() / 60;
  const lon = Math.max(-180, Math.min(180, offsetHours * 15));
  return { lat: 39.5, lon };
}

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

// --- Birth-zone readout: reconstruct the wall-clock time as it was, where it was. ---
function birthShift(instantMs: number, birth: BirthData): Date {
  return new Date(instantMs + actualOffset(birth) * HR);
}

/** Date label. Birth mode uses the birth zone; everything else the viewer's local zone. */
export function fmtDate(date: Date, mode: Mode, birth: BirthData): string {
  if (mode === "birth")
    return birthShift(date.getTime(), birth).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
    });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Time label, with the same birth-zone vs. local rule as fmtDate. `hour: "2-digit"`
 * forces a leading zero under 10 (08:30); 24h uses the h23 cycle so midnight reads 00:00,
 * not 24:00. The format comes from the global preference set in the panel.
 */
export function fmtTime(date: Date, mode: Mode, birth: BirthData, timeFormat: TimeFormat): string {
  const opts: Intl.DateTimeFormatOptions =
    timeFormat === "24h"
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : { hour: "2-digit", minute: "2-digit", hour12: true };
  if (mode === "birth")
    return birthShift(date.getTime(), birth).toLocaleTimeString(undefined, { ...opts, timeZone: "UTC" });
  return date.toLocaleTimeString(undefined, opts);
}

/** Viewer's local timezone abbreviation, e.g. "EST" (prototype localTzAbbr). */
export function localTzAbbr(date: Date): string {
  try {
    const s = date.toLocaleTimeString("en-US", { timeZoneName: "short" });
    const m = s.match(/[A-Z]{2,5}$/);
    if (m) return m[0];
  } catch {
    /* fall through to numeric offset */
  }
  return formatOffset(-date.getTimezoneOffset() / 60);
}

/** Timezone shown in the readout: birth zone in Birth mode, else the viewer's. */
export function readoutTz(date: Date, mode: Mode, birth: BirthData): string {
  return mode === "birth" ? tzAbbrev(birth.tzOffset, birth.isDst) : localTzAbbr(date);
}

/** ms -> "YYYY-MM-DDTHH:mm" in local time (prototype toInputValue). */
export function toInputValue(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" (local) -> ms, or NaN if empty/invalid (prototype parseInputValue). */
export function parseInputValue(val: string): number {
  if (!val) return NaN;
  const [datePart, timePart = "0:0"] = val.split("T");
  const [Y, M, D] = datePart.split("-").map(Number);
  const [h, m] = timePart.split(":").map(Number);
  return new Date(Y, (M || 1) - 1, D || 1, h || 0, m || 0).getTime();
}
