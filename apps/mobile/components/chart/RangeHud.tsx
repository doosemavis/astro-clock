import { Pressable, StyleSheet, Text, View } from "react-native";
import { NIGHT } from "@astro/engine";
import { PACES } from "../../lib/chartModel";
import type { ChartClock } from "../../hooks/useChartClock";
import { SHEET_COLLAPSED_HEIGHT } from "../BottomSheet";

/**
 * A compact transport pill that floats over the bottom of the wheel while Range is the
 * active view and the sheet is closed — so playback (Play/Pause, Restart) and Speed stay
 * reachable without opening the sheet. Speed taps cycle through the PACES presets. Button
 * height is sized off the View segmented control for a comfortable tap target.
 */
export function RangeHud({ clock }: { clock: ChartClock }) {
  const { playing, togglePlay, resetPlay, rate, setRate } = clock;
  const idx = Math.max(0, PACES.findIndex((p) => p.rate === rate));
  const cycleSpeed = () => setRate(PACES[(idx + 1) % PACES.length].rate);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.pill}>
        <Pressable onPress={togglePlay} style={styles.btn} hitSlop={6}>
          <Text style={styles.play}>{playing ? "❚❚" : "▶"}</Text>
        </Pressable>
        <Pressable onPress={resetPlay} style={styles.btn} hitSlop={6}>
          <Text style={styles.icon}>↺</Text>
        </Pressable>
        <Pressable onPress={cycleSpeed} style={styles.speed} hitSlop={6}>
          <Text style={styles.label}>{PACES[idx].label} ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: SHEET_COLLAPSED_HEIGHT + 10, alignItems: "center", pointerEvents: "box-none" },
  pill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: NIGHT.panel, borderColor: NIGHT.border, borderWidth: 1, borderRadius: 26,
    paddingHorizontal: 4,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  btn: { paddingHorizontal: 16, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  speed: { paddingHorizontal: 16, paddingVertical: 11, borderLeftColor: NIGHT.border, borderLeftWidth: 1 },
  play: { color: NIGHT.live, fontSize: 18, fontWeight: "700" },
  icon: { color: NIGHT.text, fontSize: 18, fontWeight: "600" },
  label: { color: NIGHT.text, fontSize: 14, fontWeight: "600" },
});
