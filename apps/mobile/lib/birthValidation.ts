import type { BirthData } from "@astro/engine";

export interface BirthDraft {
  name?: string;
  date: string;            // "YYYY-MM-DD"
  time: string;            // "HH:MM"
  lat: number | null;
  lon: number | null;
  tzOffset: number | null; // total offset hours
  placeLabel?: string;
}

export type ValidationResult =
  | { ok: true; birth: BirthData }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function validateBirth(d: BirthDraft): ValidationResult {
  if (!DATE_RE.test(d.date)) return { ok: false, error: "Pick a birth date." };
  if (!TIME_RE.test(d.time)) return { ok: false, error: "Pick a birth time." };
  if (d.lat === null || d.lon === null || Number.isNaN(d.lat) || Number.isNaN(d.lon)) {
    return { ok: false, error: "Choose a birth place (or enter coordinates in Advanced)." };
  }
  if (d.lat < -90 || d.lat > 90) return { ok: false, error: "Latitude must be between -90 and 90." };
  if (d.lon < -180 || d.lon > 180) return { ok: false, error: "Longitude must be between -180 and 180." };
  if (d.tzOffset === null || Number.isNaN(d.tzOffset) || d.tzOffset < -14 || d.tzOffset > 14) {
    return { ok: false, error: "Time zone offset is invalid." };
  }
  return {
    ok: true,
    birth: {
      name: d.name?.trim() ? d.name.trim() : undefined,
      date: d.date,
      time: d.time,
      tzOffset: d.tzOffset,
      isDst: false,
      lat: d.lat,
      lon: d.lon,
      placeLabel: d.placeLabel,
    },
  };
}
