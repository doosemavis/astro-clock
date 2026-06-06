import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, View, Text, StyleSheet, Dimensions } from "react-native";
import type { Palette, Positions } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { buildCoordinateRows } from "../../lib/coordinateRows";
import { CoordinateRow } from "./CoordinateRow";

interface Props {
  visible: boolean;
  onClose: () => void;
  fixedPos: Positions | null;   // left value column source (null => "—" placeholder)
  movablePos: Positions;        // right value column source
  fixedLabel: string;           // "Fixed" (birth/now/date) or "From" (range/compare)
  movableLabel: string;         // "Moveable" (birth/now/date) or "To" (range/compare)
}

// Leave a right gutter so the panel never reaches the top-right header buttons
// (avatar + hamburger ≈ 42px circle + 20px edge padding ≈ 62px; ~22px clearance).
const PANEL_W = Math.min(Dimensions.get("window").width - 84, 380);

/** Left slide-out comparison table (Planets | Fixed | Moveable), rendered as an in-app
 *  overlay — NOT a Modal — so the header (and its toggle button) stay above it and fully
 *  visible. It slides smoothly both ways: stays mounted through the close animation, then
 *  unmounts. Content starts below the header so the brand never overlaps the tabs. */
function CoordinatesPanelBase({ visible, onClose, fixedPos, movablePos, fixedLabel, movableLabel }: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const [mounted, setMounted] = useState(visible);
  const x = useRef(new Animated.Value(visible ? 0 : -PANEL_W)).current;
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(x, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(x, { toValue: -PANEL_W, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible, x, fade]);

  if (!mounted) return null;

  const fixed = fixedPos ? buildCoordinateRows(fixedPos) : null;
  const moveable = buildCoordinateRows(movablePos);

  return (
    <View style={s.overlay} pointerEvents="box-none">
      <Animated.View style={[s.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close coordinates" />
      </Animated.View>
      <Animated.View style={[s.panel, { transform: [{ translateX: x }] }]}>
        <View style={s.tabs}>
          <Text style={s.tabActive}>Coordinates</Text>
        </View>
        <View style={s.head}>
          <Text style={s.headGlyph}>Planets</Text>
          <View style={s.vline} />
          <Text style={s.headLabel}>{fixedLabel}</Text>
          <View style={s.vline} />
          <Text style={s.headLabel}>{movableLabel}</Text>
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          {moveable.map((m, i) => (
            <CoordinateRow key={m.key} fixed={fixed ? fixed[i] : null} moveable={m} />
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
export const CoordinatesPanel = memo(CoordinatesPanelBase);

const makeStyles = (p: Palette) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  panel: { position: "absolute", top: 0, bottom: 0, left: 0, width: PANEL_W, backgroundColor: p.panel, borderRightWidth: 1, borderRightColor: p.border, paddingTop: 96 },
  tabs: { flexDirection: "row", gap: 16, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  tabActive: { color: p.text, fontSize: 16, fontWeight: "800" },
  head: { flexDirection: "row", alignItems: "stretch", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: p.border },
  headGlyph: { width: 76, color: p.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", paddingVertical: 10 },
  headLabel: { flex: 1, color: p.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", paddingHorizontal: 6, paddingVertical: 10 },
  vline: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: p.border },
  scroll: { paddingHorizontal: 16, paddingBottom: 12 },
});
