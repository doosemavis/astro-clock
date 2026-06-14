import { PLANET_KEYS, SIGNS, type PlanetKey, type Sign } from "@astro/engine";
import type { Subject } from "./types.ts";

/** Major aspects used for forecasts. NOTE: the engine's ASPECT_DEFS omit conjunction
 *  (the wheel does not draw it); interpretations define their own set including it. */
export type TransitAspect = "conjunction" | "sextile" | "square" | "trine" | "opposition";

export const SUBJECTS: Subject[] = [...PLANET_KEYS, "ascendant"];
export const TRANSITING_BODIES: PlanetKey[] = ["sun", "moon", "mercury", "venus", "mars"];
export const TRANSIT_ASPECTS: TransitAspect[] = ["conjunction", "sextile", "square", "trine", "opposition"];

export const signKey = (subject: Subject, sign: Sign): string => `sign:${subject}:${sign}`;
export const houseKey = (planet: PlanetKey, house: number): string => `house:${planet}:${house}`;
export const transitKey = (transiting: PlanetKey, aspect: TransitAspect, natal: PlanetKey): string =>
  `transit:${transiting}:${aspect}:${natal}`;

export const allSignKeys = (): string[] =>
  SUBJECTS.flatMap((s) => SIGNS.map((sign) => signKey(s, sign)));

export const allHouseKeys = (): string[] =>
  PLANET_KEYS.flatMap((p) => Array.from({ length: 12 }, (_, i) => houseKey(p, i + 1)));

export const allTransitKeys = (): string[] =>
  TRANSITING_BODIES.flatMap((t) =>
    TRANSIT_ASPECTS.flatMap((a) => PLANET_KEYS.map((n) => transitKey(t, a, n))));
