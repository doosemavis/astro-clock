import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import {
  Animated, PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View,
} from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";

/** Height of the always-visible collapsed bar (handle + the view switcher peek). */
export const SHEET_COLLAPSED_HEIGHT = 132;

interface Props {
  children: ReactNode;
  /** Notified when the sheet snaps open/closed (lets the chart hide its floating HUD). */
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * Bottom-anchored control sheet that glides with the finger. It has ONE fixed height for
 * every view, so switching views never resizes the panel on its own — the collapsed peek
 * is identical everywhere, and a content-heavy view (Range) is revealed by dragging up
 * (its overflow scrolls inside the panel). The whole sheet is translateY-animated (native
 * driver); releasing springs to the nearest snap. No gesture library — PanResponder is
 * built in. The panel is an inset, rounded card (rounded left/right edges).
 */
export function BottomSheet({ children, onExpandedChange }: Props) {
  const { height: screenH } = useWindowDimensions();
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const expandedH = Math.round(screenH * 0.55); // fixed for all views
  const collapsedTY = Math.max(0, expandedH - SHEET_COLLAPSED_HEIGHT);

  // translateY: 0 = fully expanded, collapsedTY = only the collapsed bar showing.
  const ty = useRef(new Animated.Value(collapsedTY)).current; // starts collapsed
  const tyVal = useRef(collapsedTY);
  const startTY = useRef(0);
  const expandedRef = useRef(false);
  const collapsedTYRef = useRef(collapsedTY);
  collapsedTYRef.current = collapsedTY;
  const notifyRef = useRef(onExpandedChange);
  notifyRef.current = onExpandedChange;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const id = ty.addListener(({ value }) => { tyVal.current = value; });
    return () => ty.removeListener(id);
  }, [ty]);

  // Keep the collapsed rest position correct if the screen size changes (rotation).
  useEffect(() => {
    if (!expandedRef.current) ty.setValue(collapsedTY);
  }, [collapsedTY, ty]);

  const snapTo = (expand: boolean) => {
    if (expandedRef.current !== expand) {
      expandedRef.current = expand;
      notifyRef.current?.(expand);
    }
    // Collapsing: scroll the content back to the top so the View switcher shows in the peek.
    if (!expand) scrollRef.current?.scrollTo({ y: 0, animated: true });
    Animated.spring(ty, {
      toValue: expand ? 0 : collapsedTYRef.current,
      useNativeDriver: true,
      bounciness: 2,
      speed: 16,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => { ty.stopAnimation(); startTY.current = tyVal.current; },
      onPanResponderMove: (_e, g) => {
        const next = Math.min(collapsedTYRef.current, Math.max(0, startTY.current + g.dy));
        ty.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const mid = collapsedTYRef.current / 2;
        const expand = g.vy < -0.5 ? true : g.vy > 0.5 ? false : tyVal.current < mid;
        snapTo(expand);
      },
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.sheet, { height: expandedH, transform: [{ translateY: ty }] }]}>
        <View {...pan.panHandlers}>
          <Pressable onPress={() => snapTo(!expandedRef.current)} hitSlop={12} style={styles.handleHit}>
            <View style={styles.handle} />
          </Pressable>
        </View>
        <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>{children}</View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", pointerEvents: "box-none" },
  sheet: {
    backgroundColor: p.panel,
    marginHorizontal: 10,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderColor: p.border, borderWidth: 1,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  scroll: { flex: 1 },
  content: { paddingBottom: 28 },
  handleHit: { alignItems: "center", paddingVertical: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: p.border },
});
