import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PLANET_KEYS, PLANET_GLYPH } from "@astro/engine";
import type { Palette, PlanetKey } from "@astro/engine";
import { GLYPH_FONT } from "./palette";
import { useTheme } from "../../lib/theme";
import type { Vis, Layer } from "../../lib/chartModel";

interface Props {
  vis: Vis;
  onToggle: (key: PlanetKey | "all", layer: Layer) => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Check({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { palette: p } = useTheme();
  const s = checkStyle(p);
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[s.box, on && { backgroundColor: p.live, borderColor: p.live }]}>
      {on ? <Text style={s.tick}>✓</Text> : null}
    </Pressable>
  );
}
const checkStyle = (p: Palette) => StyleSheet.create({
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: p.border, alignItems: "center", justifyContent: "center" },
  tick: { color: p.bg, fontSize: 14, fontWeight: "800" },
});

/** Per-planet show/hide grid: a Fixed (natal) and a Moving (live) checkbox per planet,
 *  plus an All row. Mirrors the web visibility panel. Themed via useTheme. */
function VisGridBase({ vis, onToggle }: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const allNatal = PLANET_KEYS.every((k) => vis.natal[k]);
  const allLive = PLANET_KEYS.every((k) => vis.live[k]);
  return (
    <View>
      <View style={s.row}>
        <Text style={[s.name, s.headLabel]}>Glyph</Text>
        <Text style={s.colHead}>Fixed</Text>
        <Text style={s.colHead}>Moving</Text>
      </View>
      <View style={s.row}>
        <Text style={[s.name, s.allLabel]}>All</Text>
        <View style={s.col}><Check on={allNatal} onPress={() => onToggle("all", "natal")} /></View>
        <View style={s.col}><Check on={allLive} onPress={() => onToggle("all", "live")} /></View>
      </View>
      {PLANET_KEYS.map((key) => (
        <View key={key} style={s.row}>
          <Text style={s.name}><Text style={s.glyph}>{PLANET_GLYPH[key]}</Text>  {cap(key)}</Text>
          <View style={s.col}><Check on={vis.natal[key]} onPress={() => onToggle(key, "natal")} /></View>
          <View style={s.col}><Check on={vis.live[key]} onPress={() => onToggle(key, "live")} /></View>
        </View>
      ))}
    </View>
  );
}

export const VisGrid = memo(VisGridBase);

const makeStyles = (p: Palette) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  name: { flex: 1, color: p.text, fontSize: 14 },
  glyph: { fontFamily: GLYPH_FONT, color: p.live, fontSize: 16 },
  col: { width: 64, alignItems: "center" },
  colHead: { width: 64, textAlign: "center", color: p.seclabel, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  headLabel: { color: p.seclabel, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  allLabel: { fontWeight: "700" },
});
