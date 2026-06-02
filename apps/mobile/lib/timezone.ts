import { formatOffset } from "@astro/engine";

/**
 * Total UTC offset (hours) that `ianaTz` had at the given local birth date/time.
 * Reads the zone's wall-clock for the provisional instant (the local components treated
 * as UTC) via Intl; the gap between that wall-clock and the provisional instant is the
 * offset. Handles historical DST. Fractional zones (+5.5, +5.75) are preserved.
 */
export function offsetHoursAt(date: string, time: string, ianaTz: string): number {
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  const provisionalMs = Date.UTC(Y, M - 1, D, h, m);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: ianaTz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(provisionalMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0; // some engines emit "24" for midnight
  const zoneWallMs = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return (zoneWallMs - provisionalMs) / 3600000;
}

/** Absolute instant (ms) for a wall-clock date/time interpreted in `zone`. */
export function zonedInstant(date: string, time: string, zone: string): number {
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  return Date.UTC(Y, M - 1, D, h || 0, m || 0) - offsetHoursAt(date, time, zone) * 3600000;
}

/** Short zone label for a moment, e.g. "CDT"; falls back to "UTC-5" if unavailable. */
export function zoneAbbr(date: string, time: string, zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone, timeZoneName: "short", hour: "2-digit",
    }).formatToParts(new Date(zonedInstant(date, time, zone)));
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    if (name && !/^GMT[+-]/.test(name)) return name;
  } catch { /* fall through to numeric offset */ }
  return formatOffset(offsetHoursAt(date, time, zone));
}
