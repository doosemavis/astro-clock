import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Palette } from "@astro/engine";
import { GLYPH_FONT } from "./chart/palette";
import { useTheme } from "../lib/theme";

interface Props {
  /** Glyph shown as the default avatar image (the user's sign). */
  glyph: string;
  size?: number;
}

/** A circular avatar. Default content is the user's sign glyph; a future `imageUri` could
 *  render an <Image> instead. Themed via useTheme. */
function AvatarBase({ glyph, size = 42 }: Props) {
  const { palette: p } = useTheme();
  const s = styles(p);
  return (
    <View style={[s.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.glyph, { fontSize: size * 0.5 }]}>{glyph}</Text>
    </View>
  );
}

export const Avatar = memo(AvatarBase);

const styles = (p: Palette) => StyleSheet.create({
  circle: { borderWidth: 1.5, borderColor: p.live, backgroundColor: p.panel, alignItems: "center", justifyContent: "center" },
  glyph: { fontFamily: GLYPH_FONT, color: p.live },
});
