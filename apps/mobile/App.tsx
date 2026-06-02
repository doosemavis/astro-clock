import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFonts, NotoSansSymbols_400Regular } from "@expo-google-fonts/noto-sans-symbols";
import { DEFAULT_BIRTH, birthInstant, positions, NIGHT } from "@astro/engine";
import type { BirthData } from "@astro/engine";
import { GLYPH_FONT } from "./components/chart/palette";
import { ChartWheel } from "./components/chart/ChartWheel";
import { BirthForm } from "./components/BirthForm";
import { loadBirth, saveBirth } from "./lib/birthStore";

export default function App() {
  // Gate on the glyph font: rendering planet glyphs before it loads would flash tofu.
  const [fontsLoaded] = useFonts({ [GLYPH_FONT]: NotoSansSymbols_400Regular });
  const [birth, setBirth] = useState<BirthData>(DEFAULT_BIRTH);
  const [editing, setEditing] = useState(false);

  // Load the saved birth on launch (falls back to DEFAULT_BIRTH).
  useEffect(() => {
    let active = true;
    loadBirth().then((b) => { if (active && b) setBirth(b); });
    return () => { active = false; };
  }, []);

  const natalPos = useMemo(() => positions(birthInstant(birth)), [birth]);
  const [launchedAt] = useState(() => new Date());
  const livePos = useMemo(() => positions(launchedAt), [launchedAt]);

  const displayName = birth.name && birth.name !== "You" ? birth.name : "Your chart";

  function onSave(b: BirthData) {
    setBirth(b);
    saveBirth(b).catch(() => { /* local cache only; ignore write errors */ });
    setEditing(false);
  }

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>MoveStar</Text>
      <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
        <Text style={styles.editText}>{displayName}  ✎</Text>
      </Pressable>
      {fontsLoaded
        ? <ChartWheel natalPositions={natalPos} livePositions={livePos} />
        : <Text style={styles.note}>loading…</Text>}
      <BirthForm visible={editing} initial={birth} onSave={onSave} onCancel={() => setEditing(false)} />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT.bg, alignItems: "center", justifyContent: "center", gap: 10, padding: 12 },
  brand: { color: NIGHT.text, fontSize: 28, letterSpacing: 5, fontWeight: "600" },
  editBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  editText: { color: NIGHT.live, fontSize: 15, letterSpacing: 1 },
  note: { color: NIGHT.textDim, fontSize: 13, letterSpacing: 2 },
});
