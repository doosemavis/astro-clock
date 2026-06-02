// Shared types for the astro engine. Pure data — no DOM, no platform deps.

export type PlanetKey =
  | "sun" | "moon" | "mercury" | "venus" | "mars"
  | "jupiter" | "saturn" | "uranus" | "neptune" | "pluto";

// Same draw order as the prototype's PLANETS array.
export const PLANET_KEYS: PlanetKey[] = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
];

export const PLANET_GLYPH: Record<PlanetKey, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

export type Sign = (typeof SIGNS)[number];

/** Zodiac symbols, keyed to SIGNS — used for the user's sign avatar. */
export const SIGN_GLYPH: Record<Sign, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍",
  Libra: "♎", Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};

/** Geocentric ecliptic longitude (degrees, 0..360) for every body. */
export type Positions = Record<PlanetKey, number>;

/**
 * A user's birth data — the single source of truth for a chart.
 * Mirrors the prototype's birth object exactly (DEFAULT_BIRTH).
 */
export interface BirthData {
  name?: string;
  /** ISO date, e.g. "1992-07-29" */
  date: string;
  /** 24h time, e.g. "14:28" */
  time: string;
  /** Standard UTC offset in hours, e.g. -6 (NOT including DST). */
  tzOffset: number;
  /** Whether the birth occurred during daylight saving (adds +1h). */
  isDst: boolean;
  lat: number;
  lon: number;
  placeLabel?: string;
  /** IANA zone the offset was derived from (e.g. "America/Chicago"), so the birth form can
   *  re-display the chosen timezone when editing. Optional — older saved charts lack it. */
  ianaTz?: string;
}

export type AspectTier = "major" | "minor";

/** One aspect definition — angle, allowed orb, tier, and both theme shades. */
export interface AspectDef {
  angle: number;
  orb: number;
  tier: AspectTier;
  name: string;
  /** stroke for the dark (Celestial Midnight) theme */
  dark: string;
  /** deeper shade of the same hue for the light theme */
  light: string;
  /** SVG dash pattern ("" = solid) */
  dash: string;
  opacity: number;
  width: number;
}

export interface AspectHit {
  a: PlanetKey;
  b: PlanetKey;
  def: AspectDef;
  /** how far from exact, in degrees */
  delta: number;
}
