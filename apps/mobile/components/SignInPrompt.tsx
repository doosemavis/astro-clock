import { useMemo } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";

/** Anonymous-view call to action: tap to open the login sheet. */
export function SignInPrompt({ onPress }: { onPress: () => void }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <Pressable style={styles.prompt} onPress={onPress} hitSlop={8}>
      <Text style={styles.text}>Sign in to chart your birth →</Text>
    </Pressable>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  prompt: {
    marginTop: 14, alignSelf: "center",
    backgroundColor: p.panel, borderColor: p.live, borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11,
  },
  text: { color: p.live, fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
});
