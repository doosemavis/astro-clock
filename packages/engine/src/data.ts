// Static reference data, ported verbatim from the prototype: default birth, cities,
// per-offset representative city, and timezone abbreviations.
import type { BirthData } from "./types.ts";

/** The prototype's DEFAULT_BIRTH (used until the user enters their own). */
export const DEFAULT_BIRTH: BirthData = {
  name: "You", date: "1992-07-29", time: "14:28",
  tzOffset: -6, isDst: true, lat: 35.8423, lon: -90.7043, placeLabel: "Jonesboro, AR",
};

export interface City { lat: number; lon: number; off: number; }

/** Curated cities (offset = STANDARD time; DST handled by the isDst flag). */
export const CITIES: Record<string, City> = {
  "Jonesboro, AR": { lat: 35.8423, lon: -90.7043, off: -6 },
  "New York, NY": { lat: 40.7128, lon: -74.006, off: -5 },
  "Los Angeles, CA": { lat: 34.0522, lon: -118.2437, off: -8 },
  "Chicago, IL": { lat: 41.8781, lon: -87.6298, off: -6 },
  "Houston, TX": { lat: 29.7604, lon: -95.3698, off: -6 },
  "Denver, CO": { lat: 39.7392, lon: -104.9903, off: -7 },
  "Atlanta, GA": { lat: 33.749, lon: -84.388, off: -5 },
  "Miami, FL": { lat: 25.7617, lon: -80.1918, off: -5 },
  "Seattle, WA": { lat: 47.6062, lon: -122.3321, off: -8 },
  "Toronto, ON": { lat: 43.6532, lon: -79.3832, off: -5 },
  "Mexico City, MX": { lat: 19.4326, lon: -99.1332, off: -6 },
  "London, UK": { lat: 51.5074, lon: -0.1278, off: 0 },
  "Paris, FR": { lat: 48.8566, lon: 2.3522, off: 1 },
  "Berlin, DE": { lat: 52.52, lon: 13.405, off: 1 },
  "Madrid, ES": { lat: 40.4168, lon: -3.7038, off: 1 },
  "Rome, IT": { lat: 41.9028, lon: 12.4964, off: 1 },
  "Moscow, RU": { lat: 55.7558, lon: 37.6173, off: 3 },
  "Dubai, AE": { lat: 25.2048, lon: 55.2708, off: 4 },
  "Mumbai, IN": { lat: 19.076, lon: 72.8777, off: 5.5 },
  "Singapore": { lat: 1.3521, lon: 103.8198, off: 8 },
  "Hong Kong": { lat: 22.3193, lon: 114.1694, off: 8 },
  "Tokyo, JP": { lat: 35.6762, lon: 139.6503, off: 9 },
  "Sydney, AU": { lat: -33.8688, lon: 151.2093, off: 10 },
  "Auckland, NZ": { lat: -36.8485, lon: 174.7633, off: 12 },
  "São Paulo, BR": { lat: -23.5505, lon: -46.6333, off: -3 },
  "Buenos Aires, AR": { lat: -34.6037, lon: -58.3816, off: -3 },
  "Lagos, NG": { lat: 6.5244, lon: 3.3792, off: 1 },
  "Cairo, EG": { lat: 30.0444, lon: 31.2357, off: 2 },
  "Johannesburg, ZA": { lat: -26.2041, lon: 28.0473, off: 2 },
};

/** Representative city per UTC offset for the timezone dropdown ("UTC+9 · Tokyo"). */
export const OFFSET_CITY: Record<string, string> = {
  "-12": "Baker Island", "-11": "Pago Pago", "-10": "Honolulu", "-9.5": "Marquesas",
  "-9": "Anchorage", "-8": "Los Angeles", "-7": "Denver", "-6": "Chicago", "-5": "New York",
  "-4": "Halifax", "-3.5": "Newfoundland", "-3": "São Paulo", "-2": "Fernando de Noronha",
  "-1": "Azores", "0": "London", "1": "Paris", "2": "Cairo", "3": "Moscow", "3.5": "Tehran",
  "4": "Dubai", "4.5": "Kabul", "5": "Karachi", "5.5": "Mumbai", "6": "Dhaka", "6.5": "Yangon",
  "7": "Bangkok", "8": "Singapore", "9": "Tokyo", "9.5": "Adelaide", "10": "Sydney",
  "10.5": "Lord Howe", "11": "Honiara", "12": "Auckland", "13": "Nukuʻalofa", "14": "Kiritimati",
};

export const TZ_STD: Record<string, string> = {
  "-10": "HST", "-9": "AKST", "-8": "PST", "-7": "MST", "-6": "CST", "-5": "EST", "-4": "AST",
  "-3.5": "NST", "-3": "ART", "0": "GMT", "1": "CET", "2": "EET", "3": "MSK", "3.5": "IRST",
  "4": "GST", "5": "PKT", "5.5": "IST", "6": "BST", "7": "ICT", "8": "CST", "9": "JST",
  "9.5": "ACST", "10": "AEST", "12": "NZST",
};

export const TZ_DAY: Record<string, string> = {
  "-9": "AKDT", "-8": "PDT", "-7": "MDT", "-6": "CDT", "-5": "EDT", "-4": "ADT",
  "0": "BST", "1": "CEST", "2": "EEST", "10": "AEDT", "12": "NZDT",
};

export const OFFSETS = [
  -12, -11, -10, -9.5, -9, -8, -7, -6, -5, -4, -3.5, -3, -2, -1, 0, 1, 2, 3, 3.5,
  4, 4.5, 5, 5.5, 6, 6.5, 7, 8, 9, 9.5, 10, 10.5, 11, 12, 13, 14,
];

export function formatOffset(v: number): string {
  const s = v < 0 ? "-" : "+", a = Math.abs(v), h = Math.floor(a), m = Math.round((a - h) * 60);
  return "UTC" + s + h + (m ? ":" + String(m).padStart(2, "0") : "");
}

/** Friendly tz abbreviation by standard offset + DST flag (prototype tzAbbrev). */
export function tzAbbrev(stdOffset: number, dst: boolean): string {
  const k = String(stdOffset);
  if (dst && TZ_DAY[k]) return TZ_DAY[k];
  return TZ_STD[k] || formatOffset(stdOffset + (dst ? 1 : 0));
}
