// Local view-layer types for the chart UI. The engine owns all astronomy/data types;
// these only describe interactive state that lives in the React layer.
import type { PlanetKey } from "@astro/engine";

/** Which chart the moveable glyphs show. Mirrors the prototype's state.mode.
 *  "compare" renders two independent single-moment wheels side by side. */
export type Mode = "birth" | "now" | "moment" | "range" | "compare";

/** Arrangement of the two Compare wheels. "overlay" is reserved for a later task. */
export type CompareLayout = "side" | "stacked";

/** Theme selection. "auto" blends day/night from the real Sun altitude. */
export type ThemeMode = "light" | "dark" | "auto";

/** Global time-of-day display format. Drives every time readout + the picker. */
export type TimeFormat = "12h" | "24h";

/** The two glyph layers that can be shown/hidden per planet. */
export type Layer = "natal" | "live";

export type VisMap = Record<PlanetKey, boolean>;

export interface Vis {
  natal: VisMap;
  live: VisMap;
}

/** A playback speed for Range mode (sim-time per real second). */
export interface Pace {
  label: string;
  rate: number;
  note: string;
}
