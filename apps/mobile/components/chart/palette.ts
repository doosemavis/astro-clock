/** Bundled symbols-font family carrying the planet glyphs (☉☽☿…). Must match the
 *  key passed to useFonts() in App.tsx and the @expo-google-fonts export name. */
export const GLYPH_FONT = "NotoSansSymbols_400Regular";

/** Chart drawing constants — single source, no magic numbers in the SVG layers.
 *  Values mirror the web Dial/NatalLayer (stroke widths, opacities, sizes). */
export const CHART = {
  ringStroke: 1.8,
  ringOpacity: 0.82,
  liveRingOpacity: 0.5,
  tickStroke: 1.3,
  tickOpacity: 0.62,
  boundStroke: 1.8,
  boundOpacity: 0.78,
  tickLength: 8,
  tokenStroke: 1.8,
  wheelPadding: 24,
  signFontSize: 17,
  signLetterSpacing: 2.5,
  signSpan: 28,
  natalGlyphSize: 22,
  natalTokenR: 16,
  natalTickStroke: 1.8,
  natalTickOpacity: 0.6,
  liveGlyphSize: 31,
} as const;
