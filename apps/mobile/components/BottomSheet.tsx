import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Animated, PanResponder, Pressable, ScrollView, StyleSheet, useWindowDimensions, View,
} from "react-native";
import { NIGHT } from "@astro/engine";

/** Height of the always-visible collapsed bar (handle + readout + mode switcher). */
export const SHEET_COLLAPSED_HEIGHT = 132;

/** Approximate height of the drag handle area above the scrollable content. */
const HANDLE_H = 28;

interface Props {
  children: ReactNode;
  /** Notified when the sheet snaps open/closed (lets the chart hide its floating HUD). */
  onExpandedChange?: (expanded: boolean) => void;
}

/**
 * Bottom-anchored control sheet that glides with the finger. The whole sheet is
 * translateY-animated (native driver) so dragging the handle reveals more/less of the
 * controls smoothly; releasing springs to the nearest snap (collapsed bar vs. full).
 * Sheet height tracks its content (capped at 60% of the screen) so simple modes show a
 * short sheet and barely cover the wheel. No gesture library — PanResponder is built in.
 */
export function BottomSheet({ children, onExpandedChange }: Props) {
  const { height: screenH } = useWindowDimensions();
  const maxH = Math.round(screenH * 0.6);
  const [contentH, setContentH] = useState(0);
  const sheetH = contentH > 0 ? Math.min(contentH + HANDLE_H, maxH) : maxH;
  const collapsedTY = Math.max(0, sheetH - SHEET_COLLAPSED_HEIGHT);

  // translateY: 0 = fully expanded, collapsedTY = only the collapsed bar showing.
  const ty = useRef(new Animated.Value(999)).current; // starts off-screen until measured
  const tyVal = useRef(0);
  const startTY = useRef(0);
  const expandedRef = useRef(false);
  const collapsedTYRef = useRef(collapsedTY);
  collapsedTYRef.current = collapsedTY;
  const initRef = useRef(false);
  const notifyRef = useRef(onExpandedChange);
  notifyRef.current = onExpandedChange;

  useEffect(() => {
    const id = ty.addListener(({ value }) => { tyVal.current = value; });
    return () => ty.removeListener(id);
  }, [ty]);

  const snapTo = (expand: boolean) => {
    if (expandedRef.current !== expand) {
      expandedRef.current = expand;
      notifyRef.current?.(expand);
    }
    Animated.spring(ty, {
      toValue: expand ? 0 : collapsedTYRef.current,
      useNativeDriver: true,
      bounciness: 2,
      speed: 16,
    }).start();
  };

  // First measurement rests collapsed; later content changes (mode switch) keep the
  // collapsed bar height correct without yanking an expanded sheet shut.
  useEffect(() => {
    if (contentH <= 0) return;
    if (!initRef.current) {
      initRef.current = true;
      ty.setValue(collapsedTY);
    } else if (!expandedRef.current) {
      ty.setValue(collapsedTY);
    }
  }, [contentH, collapsedTY, ty]);

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
      <Animated.View style={[styles.sheet, { height: sheetH, transform: [{ translateY: ty }] }]}>
        <View {...pan.panHandlers}>
          <Pressable onPress={() => snapTo(!expandedRef.current)} hitSlop={12} style={styles.handleHit}>
            <View style={styles.handle} />
          </Pressable>
        </View>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.content} onLayout={(e) => setContentH(e.nativeEvent.layout.height)}>
            {children}
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", pointerEvents: "box-none" },
  sheet: {
    backgroundColor: NIGHT.panel,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopColor: NIGHT.border, borderTopWidth: 1,
    paddingHorizontal: 16,
  },
  scroll: { flex: 1 },
  content: { paddingBottom: 28 },
  handleHit: { alignItems: "center", paddingVertical: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: NIGHT.border },
});
