/** iOS gives bare zodiac/planet codepoints (e.g. Leo, Venus, Mars) a default *emoji*
 *  presentation, so react-native-svg / React Native <Text> render the color emoji instead of
 *  the monochrome NotoSansSymbols glyph. Appending U+FE0E (the text variation selector) forces
 *  the text glyph. Harmless no-op on codepoints that are already text-default (Sun, Moon). */
// Built from the codepoint to keep an invisible control char out of the source.
export const VS_TEXT_PRESENTATION = String.fromCharCode(0xfe0e);

/** Append the text-presentation selector so a glyph renders as the NotoSansSymbols symbol
 *  rather than an iOS color emoji. */
export function textGlyph(glyph: string): string {
  return `${glyph}${VS_TEXT_PRESENTATION}`;
}
