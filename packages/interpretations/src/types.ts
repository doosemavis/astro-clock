import type { PlanetKey } from "@astro/engine";

/** A natal subject is one of the 10 planets or the ascendant (Rising). */
export type Subject = PlanetKey | "ascendant";

export interface InterpretationMeta {
  model: string;       // generating model id
  generatedAt: string; // ISO-8601 timestamp
  reviewed: boolean;   // human-reviewed gate
  v: number;           // content version
}

export interface Interpretation {
  key: string;
  title: string;
  summary: string;     // FREE teaser
  body: string;        // PRO
  keywords?: string[];
  meta: InterpretationMeta;
}

/** A bank is a map keyed by Interpretation.key. */
export type Bank = Record<string, Interpretation>;
