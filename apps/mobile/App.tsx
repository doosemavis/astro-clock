import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFonts, NotoSansSymbols_400Regular } from "@expo-google-fonts/noto-sans-symbols";
import { DEFAULT_BIRTH, birthInstant, positions, NIGHT } from "@astro/engine";
import { GLYPH_FONT } from "./components/chart/palette";
import { ChartWheel } from "./components/chart/ChartWheel";

export default function App() {
  // Gate on the glyph font: rendering planet glyphs before it loads would flash tofu.
  const [fontsLoaded] = useFonts({ [GLYPH_FONT]: NotoSansSymbols_400Regular });
  // Birth chart (fixed, outer ring) + a snapshot of the current sky (inner ring), frozen at
  // launch — the continuous animation comes in a later slice.
  const natalPos = useMemo(() => positions(birthInstant(DEFAULT_BIRTH)), []);
  const [launchedAt] = useState(() => new Date());
  const livePos = useMemo(() => positions(launchedAt), [launchedAt]);

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>MoveStar</Text>
      {fontsLoaded
        ? <ChartWheel natalPositions={natalPos} livePositions={livePos} />
        : <Text style={styles.note}>loading…</Text>}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT.bg, alignItems: "center", justifyContent: "center", gap: 16, padding: 12 },
  brand: { color: NIGHT.text, fontSize: 28, letterSpacing: 5, fontWeight: "600" },
  note: { color: NIGHT.textDim, fontSize: 13, letterSpacing: 2 },
});
