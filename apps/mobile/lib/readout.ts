// Readout formatting for the living chart: the date/time/tz label under the wheel.
// Imports engine values (tzAbbrev, formatOffset) so it is verified via render, not unit
// tests. Ported verbatim from apps/web/components/Chart/chartModel.ts.
import { tzAbbrev, formatOffset } from "@astro/engine";
import type { BirthData } from "@astro/engine";
import { actualOffset, HR } from "./chartModel";
import type { Mode, TimeFormat } from "./chartModel";

// Reconstruct the wall-clock time as it was, where it was (birth zone).
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

/** Time label, birth-zone vs. local per mode; 24h uses the h23 cycle (00:00, not 24:00).
 *  `withSeconds` adds a live seconds field (used by the ticking Now readout). */
export function fmtTime(date: Date, mode: Mode, birth: BirthData, timeFormat: TimeFormat, withSeconds = false): string {
  const base: Intl.DateTimeFormatOptions =
    timeFormat === "24h"
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : { hour: "2-digit", minute: "2-digit", hour12: true };
  const opts: Intl.DateTimeFormatOptions = withSeconds ? { ...base, second: "2-digit" } : base;
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
