import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { DEFAULT_BIRTH, birthInstant, positions, ascendant, signOf } from "@astro/engine";

export default function App() {
  const date = birthInstant(DEFAULT_BIRTH);
  const np = positions(date);
  const asc = ascendant(date, DEFAULT_BIRTH.lat, DEFAULT_BIRTH.lon);
  const bigThree = `☉ ${signOf(np.sun)}  ·  ☽ ${signOf(np.moon)}  ·  ↑ ${signOf(asc)}`;

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>MoveStar</Text>
      <Text style={styles.signs}>{bigThree}</Text>
      <Text style={styles.note}>engine running on React Native</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0b22", alignItems: "center", justifyContent: "center", gap: 14, padding: 24 },
  brand: { color: "#e9eaf6", fontSize: 34, letterSpacing: 6, fontWeight: "600" },
  signs: { color: "#c7cbe6", fontSize: 18, letterSpacing: 1 },
  note: { color: "#6a6f99", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginTop: 8 },
});
