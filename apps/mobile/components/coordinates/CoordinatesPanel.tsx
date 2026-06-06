import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Modal, Pressable, ScrollView, View, Text, StyleSheet, Dimensions } from "react-native";
import type { Palette, Positions } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { buildCoordinateRows } from "../../lib/coordinateRows";
import { CoordinateRow } from "./CoordinateRow";

interface Props {
  visible: boolean;
  onClose: () => void;
  natalPos: Positions | null;   // null when no birth chart is set
  livePos: Positions;
}

const PANEL_W = Math.min(Dimensions.get("window").width * 0.86, 380);

/** Left slide-out: a Fixed | Moveable comparison table, one row per planet.
 *  The "Staircase" tab is a disabled stub for a future v2. */
function CoordinatesPanelBase({ visible, onClose, natalPos, livePos }: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const x = useRef(new Animated.Value(-PANEL_W)).current;

  useEffect(() => {
    Animated.timing(x, { toValue: visible ? 0 : -PANEL_W, duration: 200, useNativeDriver: true }).start();
  }, [visible, x]);

  const fixed = natalPos ? buildCoordinateRows(natalPos) : null;
  const moveable = buildCoordinateRows(livePos);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <Animated.View style={[s.panel, { transform: [{ translateX: x }] }]}>
        <View style={s.tabs}>
          <Text style={s.tabActive}>Coordinates</Text>
          <Text style={s.tabDisabled}>Staircase</Text>
        </View>
        <View style={s.head}>
          <View style={s.gutter} />
          <Text style={s.headLabel}>Fixed</Text>
          <View style={s.vline} />
          <Text style={s.headLabel}>Moveable</Text>
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          {moveable.map((m, i) => (
            <CoordinateRow key={m.key} fixed={fixed ? fixed[i] : null} moveable={m} />
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
export const CoordinatesPanel = memo(CoordinatesPanelBase);

const makeStyles = (p: Palette) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  panel: { position: "absolute", top: 0, bottom: 0, left: 0, width: PANEL_W, backgroundColor: p.panel, borderRightWidth: 1, borderRightColor: p.border, paddingTop: 56 },
  tabs: { flexDirection: "row", gap: 16, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  tabActive: { color: p.text, fontSize: 16, fontWeight: "800" },
  tabDisabled: { color: p.textDim, fontSize: 16, fontWeight: "600", opacity: 0.5 },
  head: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: p.border },
  gutter: { width: 28 },
  headLabel: { flex: 1, color: p.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", paddingHorizontal: 8 },
  vline: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: p.border },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
});
