import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, View, Text, StyleSheet, Dimensions } from "react-native";
import type { Palette, Positions } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { buildCoordinateRows } from "../../lib/coordinateRows";
import { CoordinateRow } from "./CoordinateRow";
import { Segmented } from "../Segmented";
import { ReadingsList } from "./ReadingsList";

interface Props {
  visible: boolean;
  onClose: () => void;
  fixedPos: Positions | null;   // left value column source (null => "—" placeholder)
  movablePos: Positions;        // right value column source
  fixedLabel: string;           // "Fixed" (birth/now/date) or "From" (range/compare)
  movableLabel: string;         // "Moveable" (birth/now/date) or "To" (range/compare)
  natalPos: Positions;          // birth chart positions (for Readings tab)
  ascLon: number;               // natal ascendant longitude (for Readings tab)
  isPro: boolean;               // entitlement (for Readings tab gating + Coordinates tab lock)
  onUpgrade: () => void;        // launch the Pro paywall (Coordinates tab lock CTA)
}

// Leave a right gutter so the panel never reaches the top-right header buttons
// (avatar + hamburger ≈ 42px circle + 20px edge padding ≈ 62px; ~22px clearance).
const PANEL_W = Math.min(Dimensions.get("window").width - 84, 380);

/** Left slide-out comparison table (Planets | Fixed | Moveable), rendered as an in-app
 *  overlay — NOT a Modal — so the header (and its toggle button) stay above it and fully
 *  visible. It slides smoothly both ways: stays mounted through the close animation, then
 *  unmounts. Content starts below the header so the brand never overlaps the tabs. */
function CoordinatesPanelBase({ visible, onClose, fixedPos, movablePos, fixedLabel, movableLabel, natalPos, ascLon, isPro, onUpgrade }: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const [mounted, setMounted] = useState(visible);
  const [showNames, setShowNames] = useState(false);
  const [tab, setTab] = useState<"coordinates" | "readings">("coordinates");
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
          <View style={s.tabRow}>
            <Pressable onPress={() => setTab("coordinates")}>
              <Text style={tab === "coordinates" ? s.tabActive : s.tabInactive}>Coordinates</Text>
            </Pressable>
            <Pressable onPress={() => setTab("readings")}>
              <Text style={tab === "readings" ? s.tabActive : s.tabInactive}>Readings</Text>
            </Pressable>
          </View>
          {tab === "coordinates" && isPro ? (
            <View style={s.toggle}>
              <Segmented
                options={[{ key: "glyph", label: "Glyph" }, { key: "name", label: "Name" }]}
                value={showNames ? "name" : "glyph"}
                onChange={(v) => setShowNames(v === "name")}
              />
            </View>
          ) : null}
        </View>
        {tab === "coordinates" ? (
          isPro ? (
            <>
              <View style={s.head}>
                <Text style={s.headGlyph}>Planets</Text>
                <View style={s.vline} />
                <Text style={s.headLabel}>{fixedLabel}</Text>
                <View style={s.vline} />
                <Text style={s.headLabel}>{movableLabel}</Text>
              </View>
              <ScrollView style={s.body} contentContainerStyle={s.scroll}>
                {moveable.map((m, i) => (
                  <CoordinateRow key={m.key} fixed={fixed ? fixed[i] : null} moveable={m} showName={showNames} />
                ))}
              </ScrollView>
            </>
          ) : (
            <View style={s.proLock}>
              <Text style={s.proLockIcon}>🔒</Text>
              <Text style={s.proLockTitle}>Pro Feature</Text>
              <Text style={s.proLockBody}>Coordinates is a Pro feature.</Text>
              <Pressable style={s.proLockBtn} onPress={onUpgrade}>
                <Text style={s.proLockBtnText}>Unlock Pro</Text>
              </Pressable>
            </View>
          )
        ) : (
          <ReadingsList natalPos={natalPos} ascLon={ascLon} isPro={isPro} />
        )}
      </Animated.View>
    </View>
  );
}
export const CoordinatesPanel = memo(CoordinatesPanelBase);

const makeStyles = (p: Palette) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  panel: { position: "absolute", top: 0, bottom: 0, left: 0, width: PANEL_W, backgroundColor: p.panel, borderRightWidth: 1, borderRightColor: p.border, paddingTop: 96 },
  tabs: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  tabRow: { flexDirection: "row", gap: 16 },
  tabActive: { color: p.text, fontSize: 16, fontWeight: "800" },
  tabInactive: { color: p.textDim, fontSize: 16, fontWeight: "600" },
  toggle: { width: 150 },
  head: { flexDirection: "row", alignItems: "stretch", borderBottomWidth: 1, borderBottomColor: p.border },
  headGlyph: { width: 76, color: p.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", paddingVertical: 10 },
  headLabel: { flex: 1, color: p.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, textAlign: "center", paddingHorizontal: 6, paddingVertical: 10 },
  vline: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: p.border },
  body: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 12 },
  proLock: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 12 },
  proLockIcon: { fontSize: 36 },
  proLockTitle: { color: p.text, fontSize: 18, fontWeight: "700", textAlign: "center" },
  proLockBody: { color: p.textDim, fontSize: 14, textAlign: "center", lineHeight: 20 },
  proLockBtn: { backgroundColor: p.live, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 28, alignItems: "center", marginTop: 4 },
  proLockBtnText: { color: p.bg, fontSize: 15, fontWeight: "700" },
});
