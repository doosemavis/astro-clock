import { memo, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { NIGHT } from "@astro/engine";
import type { Positions } from "@astro/engine";
import { CHART } from "./palette";
import { CompareWheel } from "./CompareWheel";
import { pageIndex } from "../../lib/chartModel";
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
// wheel's caption/sub + gaps). A tuned constant — refine on-device like the 3a sheet height.
const COMPARE_CHROME = 360;

function CompareViewBase({ a, b, view, showMajor, showMinor }: Props) {
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);

  if (view === "pages") {
    const full = Math.max(0, Math.min(width, height) - CHART.wheelPadding);
    const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
      setPage(pageIndex(e.nativeEvent.contentOffset.x, width, 2));
    return (
      <View style={styles.fill}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onEnd}
        >
          {[a, b].map((w, i) => (
            <View key={i} style={[styles.page, { width }]}>
              <CompareWheel
                idPrefix={i === 0 ? "a-" : "b-"}
                caption={w.caption}
                subCaption={w.sub}
                size={full}
                pos={w.pos}
                showMajor={showMajor}
                showMinor={showMinor}
              />
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
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
  fill: { flex: 1, alignSelf: "stretch" },
  page: { alignItems: "center", justifyContent: "center", paddingBottom: SHEET_COLLAPSED_HEIGHT },
  stack: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: SHEET_COLLAPSED_HEIGHT },
  dots: { position: "absolute", bottom: SHEET_COLLAPSED_HEIGHT + 14, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NIGHT.border },
  dotOn: { backgroundColor: NIGHT.live, width: 9, height: 9, borderRadius: 4.5 },
});
