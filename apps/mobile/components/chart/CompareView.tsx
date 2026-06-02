import { memo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { NIGHT } from "@astro/engine";
import type { Positions } from "@astro/engine";
import { CHART } from "./palette";
import { CompareWheel } from "./CompareWheel";
import { SHEET_COLLAPSED_HEIGHT } from "../BottomSheet";

interface WheelData {
  caption: string;
  sub: string;
  pos: Positions;
}

interface Props {
  a: WheelData;
  b: WheelData;
  view: "both" | "pages";
  showMajor: boolean;
  showMinor: boolean;
}

// Vertical chrome above/below the two wheels in "Both" (header + collapsed sheet + each
// wheel's caption pill + gaps). A tuned constant — refine on-device like the 3a sheet height.
const COMPARE_CHROME = 360;
// Room reserved above each wheel for its caption pill, so the flip card holds both faces.
const CAPTION_BLOCK = 52;
const FLIP_MS = 600;

function CompareViewBase({ a, b, view, showMajor, showMinor }: Props) {
  const { width, height } = useWindowDimensions();
  const [face, setFace] = useState(0); // 0 = Chart A (front), 1 = Chart B (back)
  const anim = useRef(new Animated.Value(0)).current;

  if (view === "pages") {
    // Pages: one full-size wheel; tap the chart (or a dot) to spin it 180° like a coin
    // and reveal the other chart. Both faces are stacked; rotateY + a hard opacity cut at
    // the edge-on midpoint swap them (opacity also covers platforms where backfaceVisibility
    // doesn't hide native SVG).
    const full = Math.max(0, Math.min(width, height) - CHART.wheelPadding);
    const cardH = full + CAPTION_BLOCK;
    const goTo = (i: number) => {
      if (i === face) return;
      setFace(i);
      Animated.timing(anim, { toValue: i, duration: FLIP_MS, useNativeDriver: true }).start();
    };
    const rotate = (from: string, to: string) =>
      anim.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
    const frontOpacity = anim.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [1, 1, 0, 0] });
    const backOpacity = anim.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] });

    return (
      <View style={styles.center}>
        <Pressable onPress={() => goTo(face === 0 ? 1 : 0)} style={{ width: full, height: cardH }}>
          <Animated.View style={[styles.face, { opacity: frontOpacity, transform: [{ perspective: 1200 }, { rotateY: rotate("0deg", "180deg") }] }]}>
            <CompareWheel idPrefix="a-" caption={a.caption} subCaption={a.sub} size={full} pos={a.pos} showMajor={showMajor} showMinor={showMinor} />
          </Animated.View>
          <Animated.View style={[styles.face, { opacity: backOpacity, transform: [{ perspective: 1200 }, { rotateY: rotate("180deg", "360deg") }] }]}>
            <CompareWheel idPrefix="b-" caption={b.caption} subCaption={b.sub} size={full} pos={b.pos} showMajor={showMajor} showMinor={showMinor} />
          </Animated.View>
        </Pressable>
        <View style={styles.dots}>
          {[0, 1].map((i) => (
            <Pressable key={i} onPress={() => goTo(i)} hitSlop={8}>
              <View style={[styles.dot, i === face && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>tap the chart to flip ⟳</Text>
      </View>
    );
  }

  // Both: two wheels stacked, each sized to fit half the available height.
  const each = Math.max(
    0,
    Math.min(width - CHART.wheelPadding, Math.floor((height - COMPARE_CHROME) / 2)),
  );
  return (
    <View style={styles.stack}>
      <CompareWheel idPrefix="a-" caption={a.caption} subCaption={a.sub} size={each} pos={a.pos} showMajor={showMajor} showMinor={showMinor} />
      <CompareWheel idPrefix="b-" caption={b.caption} subCaption={b.sub} size={each} pos={b.pos} showMajor={showMajor} showMinor={showMinor} />
    </View>
  );
}

export const CompareView = memo(CompareViewBase);

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: SHEET_COLLAPSED_HEIGHT },
  face: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", backfaceVisibility: "hidden" },
  stack: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: SHEET_COLLAPSED_HEIGHT },
  dots: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NIGHT.border },
  dotOn: { backgroundColor: NIGHT.live, width: 9, height: 9, borderRadius: 4.5 },
  hint: { color: NIGHT.textDim, fontSize: 12, marginTop: 10, letterSpacing: 0.5 },
});
