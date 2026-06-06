import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { GLYPH_FONT } from "../chart/palette";
import { textGlyph } from "../../lib/glyph";
import type { CoordinateRow as Row } from "../../lib/coordinateRows";

/** One body's readout: glyph + sign/degree + decan, with anaretic/cusp badges. */
export const CoordinateRow = memo(function CoordinateRow({ row }: { row: Row }) {
  const { palette: p } = useTheme();
  const s = makeStyles(p);
  return (
    <View style={s.row}>
      <Text style={s.glyph}>{textGlyph(row.glyph)}</Text>
      <View style={s.body}>
        <Text style={s.pos}>
          <Text style={s.sign}>{textGlyph(row.signGlyph)}</Text> {row.dms}
        </Text>
        <Text style={s.decan}>
          {row.decan === 1 ? "1st" : row.decan === 2 ? "2nd" : "3rd"} ·{" "}
          <Text style={s.sign}>{textGlyph(row.decanRulerGlyph)}</Text>
        </Text>
      </View>
      <View style={s.badges}>
        {row.anaretic ? <Text style={[s.badge, s.anaretic]}>29°</Text> : null}
        {row.cusp ? <Text style={[s.badge, s.cusp]}>cusp</Text> : null}
      </View>
    </View>
  );
});

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
    glyph: { color: p.text, fontFamily: GLYPH_FONT, fontSize: 18, width: 22, textAlign: "center" },
    body: { flex: 1 },
    pos: { color: p.text, fontSize: 14, fontWeight: "600" },
    sign: { fontFamily: GLYPH_FONT },
    decan: { color: p.textDim, fontSize: 12, marginTop: 1 },
    badges: { flexDirection: "row", gap: 4 },
    badge: { fontSize: 10, fontWeight: "800", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, overflow: "hidden" },
    anaretic: { color: p.bg, backgroundColor: p.live },
    cusp: { color: p.live, borderWidth: 1, borderColor: p.border },
  });
