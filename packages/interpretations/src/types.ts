import type { PlanetKey } from "@astro/engine";

/** A natal subject is one of the 10 planets or the ascendant (Rising). */
export type Subject = PlanetKey | "ascendant";

// Interpretation and Bank are derived from the Zod schema (single source of truth).
export type { Interpretation, Bank } from "./schema.ts";
