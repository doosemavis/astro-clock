/** Bundled symbols-font family carrying the planet glyphs (☉☽☿…). Must match the
 *  key passed to useFonts() in App.tsx and the @expo-google-fonts export name. */
export const GLYPH_FONT = "NotoSansSymbols_400Regular";

/** Chart drawing constants — single source, no magic numbers in the SVG layers.
 *  Values mirror the web Dial/NatalLayer (stroke widths, opacities, sizes). */
export const CHART = {
  ringStroke: 2.1,
  ringOpacity: 0.92,
  liveRingOpacity: 0.65,
  tickStroke: 1.6,
  tickOpacity: 0.78,
  boundStroke: 2.1,
  boundOpacity: 0.92,
  tickLength: 8,
  tokenStroke: 2.1,
  wheelPadding: 24,
  signFontSize: 22,
  signLetterSpacing: 2.5,
  signSpan: 28,
  natalGlyphSize: 24,
  natalTokenR: 16,
  liveGlyphSize: 33,
} as const;
