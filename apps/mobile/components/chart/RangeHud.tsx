import { Pressable, StyleSheet, Text, View } from "react-native";
import { NIGHT } from "@astro/engine";
import { PACES } from "../../lib/chartModel";
import type { ChartClock } from "../../hooks/useChartClock";
import { SHEET_COLLAPSED_HEIGHT } from "../BottomSheet";

/**
 * A compact transport pill that floats over the bottom of the wheel while Range is the
 * active view and the sheet is closed — so playback (Play/Pause, Loop, Restart) and Speed
 * stay reachable without opening the sheet. Speed taps cycle through the PACES presets.
 */
export function RangeHud({ clock }: { clock: ChartClock }) {
  const { playing, togglePlay, loop, toggleLoop, resetPlay, rate, setRate } = clock;
  const idx = Math.max(0, PACES.findIndex((p) => p.rate === rate));
  const cycleSpeed = () => setRate(PACES[(idx + 1) % PACES.length].rate);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.pill}>
        <Pressable onPress={togglePlay} style={styles.btn} hitSlop={6}>
          <Text style={styles.play}>{playing ? "❚❚" : "▶"}</Text>
        </Pressable>
        <Pressable onPress={toggleLoop} style={styles.btn} hitSlop={6}>
          <Text style={[styles.txt, loop && styles.on]}>Loop</Text>
        </Pressable>
        <Pressable onPress={resetPlay} style={styles.btn} hitSlop={6}>
          <Text style={styles.txt}>↺</Text>
        </Pressable>
        <Pressable onPress={cycleSpeed} style={styles.speed} hitSlop={6}>
          <Text style={styles.txt}>{PACES[idx].label} ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: SHEET_COLLAPSED_HEIGHT + 10, alignItems: "center", pointerEvents: "box-none" },
  pill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: NIGHT.panel, borderColor: NIGHT.border, borderWidth: 1, borderRadius: 24,
    paddingHorizontal: 4, paddingVertical: 2,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  btn: { paddingHorizontal: 12, paddingVertical: 8 },
  speed: { paddingHorizontal: 14, paddingVertical: 8, borderLeftColor: NIGHT.border, borderLeftWidth: 1 },
  play: { color: NIGHT.live, fontSize: 15, fontWeight: "700" },
  txt: { color: NIGHT.text, fontSize: 13, fontWeight: "600" },
  on: { color: NIGHT.live },
});
