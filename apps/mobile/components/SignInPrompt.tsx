import { useMemo } from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";

/** Anonymous-view call to action: tap to open the login sheet. The arrow is a separate
 *  Text in a center-aligned row; includeFontPadding:false + a small upward nudge lift it
 *  off the baseline to the vertical middle of the label (Android adds baseline padding). */
export function SignInPrompt({ onPress }: { onPress: () => void }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <Pressable style={styles.prompt} onPress={onPress} hitSlop={8}>
      <View style={styles.row}>
        <Text style={styles.text}>Sign in to chart your birth</Text>
        <Text style={styles.arrow}>→</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  prompt: {
    marginTop: 14, alignSelf: "center",
    backgroundColor: p.panel, borderColor: p.live, borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11,
  },
  row: { flexDirection: "row", alignItems: "center" },
  text: { color: p.live, fontSize: 15, fontWeight: "700", letterSpacing: 0.3, includeFontPadding: false },
  arrow: {
    color: p.live, fontSize: 18, fontWeight: "700", marginLeft: 6,
    includeFontPadding: false, transform: [{ translateY: -2 }],
  },
});
