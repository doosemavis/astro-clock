import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useFonts, NotoSansSymbols_400Regular } from "@expo-google-fonts/noto-sans-symbols";
import { DEFAULT_BIRTH, birthInstant, positions, ascendant, signOf, NIGHT } from "@astro/engine";
import type { BirthData } from "@astro/engine";
import { GLYPH_FONT, CHART } from "./components/chart/palette";
import { ChartWheel } from "./components/chart/ChartWheel";
import { ChartControls } from "./components/chart/ChartControls";
import { RangeHud } from "./components/chart/RangeHud";
import { BottomSheet, SHEET_COLLAPSED_HEIGHT } from "./components/BottomSheet";
import { BirthForm } from "./components/BirthForm";
import { useChartClock } from "./hooks/useChartClock";
import type { Mode, TimeFormat } from "./lib/chartModel";
import { fmtDate, fmtTime, readoutTz } from "./lib/readout";
import { loadBirth, saveBirth } from "./lib/birthStore";

const MODE_LABEL: Record<Mode, string> = { birth: "Birth", now: "Now", moment: "Date", range: "Range" };

export default function App() {
  // Gate on the glyph font: rendering planet glyphs before it loads would flash tofu.
  const [fontsLoaded] = useFonts({ [GLYPH_FONT]: NotoSansSymbols_400Regular });
  const { width, height } = useWindowDimensions();
  const wheelSize = Math.max(0, Math.min(width, height) - CHART.wheelPadding);

  const [birth, setBirth] = useState<BirthData>(DEFAULT_BIRTH);
  const [editing, setEditing] = useState(false);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const [showMajor, setShowMajor] = useState(true);
  const [showMinor, setShowMinor] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);

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

  // The chart's signature: Sun / Moon / Ascendant signs (mirrors the web bigThree).
  const bigThree = useMemo(() => {
    const asc = ascendant(new Date(birthMs), birth.lat, birth.lon);
    return `☉ ${signOf(natalPos.sun)}   ☽ ${signOf(natalPos.moon)}   ↑ ${signOf(asc)}`;
  }, [birthMs, birth.lat, birth.lon, natalPos]);

  // Persistent readout of the moment on screen — which view + when (fixed vs. moveable).
  const moment =
    `${MODE_LABEL[clock.mode]}  ·  ${fmtDate(clock.displayInstant, clock.mode, birth)}  ·  ${fmtTime(clock.displayInstant, clock.mode, birth, timeFormat, clock.mode === "now")}  ${readoutTz(clock.displayInstant, clock.mode, birth)}`;

  function onSave(b: BirthData) {
    setBirth(b);
    saveBirth(b).catch(() => { /* local cache only; ignore write errors */ });
    setEditing(false);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>MoveStar</Text>
          <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
            <Text style={styles.editText}>{displayName}  ✎</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.stage}>
        <Text style={styles.moment}>{moment}</Text>
        <Text style={styles.bigThree}>{bigThree}</Text>
        <View style={[styles.wheelBox, { width: wheelSize, height: wheelSize }]}>
          {fontsLoaded
            ? <ChartWheel natalPositions={natalPos} livePositions={livePos} showMajor={showMajor} showMinor={showMinor} />
            : <Text style={styles.note}>loading…</Text>}
        </View>
      </View>

      {clock.mode === "range" && !sheetExpanded ? <RangeHud clock={clock} /> : null}

      <BottomSheet onExpandedChange={setSheetExpanded}>
        <ChartControls
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
  root: { flex: 1, backgroundColor: NIGHT.bg },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 2 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { color: NIGHT.text, fontSize: 24, letterSpacing: 4, fontWeight: "600" },
  editBtn: { paddingVertical: 4, paddingLeft: 12 },
  editText: { color: NIGHT.live, fontSize: 15, letterSpacing: 1, textAlign: "right" },
  bigThree: { color: NIGHT.textDim, fontSize: 14, letterSpacing: 1, textAlign: "center", marginBottom: 12 },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: SHEET_COLLAPSED_HEIGHT },
  wheelBox: { alignItems: "center", justifyContent: "center" },
  // Sits directly above the wheel with a 12px gap — never overlaps the circle.
  moment: {
    color: NIGHT.text, fontSize: 13, letterSpacing: 0.5, textAlign: "center",
    // Tabular figures: every digit is the same width, so the ticking seconds never
    // resize or re-center the pill — only the seconds glyphs change in place.
    fontVariant: ["tabular-nums"],
    backgroundColor: NIGHT.panel, borderColor: NIGHT.border, borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, overflow: "hidden",
    marginBottom: 8,
  },
  note: { color: NIGHT.textDim, fontSize: 13, letterSpacing: 2 },
});
