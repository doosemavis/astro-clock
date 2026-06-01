import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { useFonts, NotoSansSymbols_400Regular } from "@expo-google-fonts/noto-sans-symbols";
import { DEFAULT_BIRTH, birthInstant, positions, NIGHT } from "@astro/engine";
import { ChartWheel } from "./components/chart/ChartWheel";

export default function App() {
  // Gate on the glyph font: rendering planet glyphs before it loads would flash tofu.
  const [fontsLoaded] = useFonts({ NotoSansSymbols_400Regular });
  const np = positions(birthInstant(DEFAULT_BIRTH));

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>MoveStar</Text>
      {fontsLoaded ? <ChartWheel positions={np} /> : <Text style={styles.note}>loading…</Text>}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT.bg, alignItems: "center", justifyContent: "center", gap: 16, padding: 12 },
  brand: { color: NIGHT.text, fontSize: 28, letterSpacing: 5, fontWeight: "600" },
  note: { color: NIGHT.textDim, fontSize: 13, letterSpacing: 2 },
});
