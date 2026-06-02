import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { PanResponder, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { NIGHT } from "@astro/engine";

interface Props {
  children: ReactNode;
}

/** Bottom-anchored control sheet. Tap the handle or drag (>24px) to expand/collapse.
 *  Collapsed reveals only the top of its content (readout + mode switcher); expanded
 *  scrolls up to 70% of the screen. No gesture library — PanResponder is built in. */
export function BottomSheet({ children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8,
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -24) setExpanded(true);
        else if (g.dy > 24) setExpanded(false);
      },
    }),
  ).current;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.sheet, expanded ? styles.sheetExpanded : styles.sheetCollapsed]}>
        <View {...pan.panHandlers}>
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={12} style={styles.handleHit}>
            <View style={styles.handle} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: NIGHT.panel,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopColor: NIGHT.border, borderTopWidth: 1,
    paddingHorizontal: 16, paddingBottom: 22,
  },
  sheetCollapsed: { maxHeight: 150 },
  sheetExpanded: { maxHeight: "70%" },
  handleHit: { alignItems: "center", paddingVertical: 8 },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: NIGHT.border },
});
