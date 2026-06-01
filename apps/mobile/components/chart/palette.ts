import { NIGHT } from "@astro/engine";

/** Dark ("Celestial Midnight") palette — reused from the engine. Light/Auto is a later slice. */
export const C = NIGHT;

/** Bundled symbols-font family carrying the planet glyphs (☉☽☿…). Must match the
 *  key passed to useFonts() in App.tsx and the @expo-google-fonts export name. */
export const GLYPH_FONT = "NotoSansSymbols_400Regular";

/** Chart drawing constants — single source, no magic numbers in the SVG layers.
 *  Values mirror the web Dial/NatalLayer (stroke widths, opacities, sizes). */
export const CHART = {
  ringStroke: 1.5,
  ringOpacity: 0.6,
  liveRingOpacity: 0.32,
  tickStroke: 1,
  tickOpacity: 0.42,
  boundStroke: 1.5,
  boundOpacity: 0.55,
  signFontSize: 17,
  signLetterSpacing: 2.5,
  signSpan: 28,
  natalGlyphSize: 22,
  natalTokenR: 16,
  natalTickStroke: 1.5,
  natalTickOpacity: 0.4,
} as const;
