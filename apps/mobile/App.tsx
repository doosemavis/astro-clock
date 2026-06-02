import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFonts, NotoSansSymbols_400Regular } from "@expo-google-fonts/noto-sans-symbols";
import { DEFAULT_BIRTH, birthInstant, positions, NIGHT } from "@astro/engine";
import type { BirthData } from "@astro/engine";
import { GLYPH_FONT } from "./components/chart/palette";
import { ChartWheel } from "./components/chart/ChartWheel";
import { ChartControls } from "./components/chart/ChartControls";
import { BottomSheet, SHEET_COLLAPSED_HEIGHT } from "./components/BottomSheet";
import { BirthForm } from "./components/BirthForm";
import { useChartClock } from "./hooks/useChartClock";
import type { TimeFormat } from "./lib/chartModel";
import { loadBirth, saveBirth } from "./lib/birthStore";

export default function App() {
  // Gate on the glyph font: rendering planet glyphs before it loads would flash tofu.
  const [fontsLoaded] = useFonts({ [GLYPH_FONT]: NotoSansSymbols_400Regular });
  const [birth, setBirth] = useState<BirthData>(DEFAULT_BIRTH);
  const [editing, setEditing] = useState(false);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const [showMajor, setShowMajor] = useState(true);
  const [showMinor, setShowMinor] = useState(true);

  // Load the saved birth on launch (falls back to DEFAULT_BIRTH).
  useEffect(() => {
    let active = true;
    loadBirth().then((b) => { if (active && b) setBirth(b); });
    return () => { active = false; };
  }, []);

  const birthMs = useMemo(() => birthInstant(birth).getTime(), [birth]);
  const natalPos = useMemo(() => positions(new Date(birthMs)), [birthMs]);
  const clock = useChartClock(birthMs);
  const livePos = useMemo(() => positions(clock.displayInstant), [clock.displayInstant]);

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
      <View style={styles.stage}>
        {fontsLoaded
          ? <ChartWheel natalPositions={natalPos} livePositions={livePos} showMajor={showMajor} showMinor={showMinor} />
          : <Text style={styles.note}>loading…</Text>}
      </View>
      <BottomSheet>
        <ChartControls
          birth={birth}
          clock={clock}
          timeFormat={timeFormat}
          onTimeFormat={setTimeFormat}
          showMajor={showMajor}
          onToggleMajor={() => setShowMajor((v) => !v)}
          showMinor={showMinor}
          onToggleMinor={() => setShowMinor((v) => !v)}
        />
      </BottomSheet>
      <BirthForm visible={editing} initial={birth} onSave={onSave} onCancel={() => setEditing(false)} />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT.bg, alignItems: "center", paddingTop: 56 },
  brand: { color: NIGHT.text, fontSize: 28, letterSpacing: 5, fontWeight: "600" },
  editBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  editText: { color: NIGHT.live, fontSize: 15, letterSpacing: 1 },
  // Reserve the collapsed sheet's height so the full wheel rests above it (the expanded
  // sheet still overlays the lower chart, but only while the user holds it open).
  stage: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", paddingBottom: SHEET_COLLAPSED_HEIGHT },
  note: { color: NIGHT.textDim, fontSize: 13, letterSpacing: 2 },
});
