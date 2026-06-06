import { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { GLYPH_FONT } from "../chart/palette";
import { textGlyph } from "../../lib/glyph";
import type { CoordinateRow as Row } from "../../lib/coordinateRows";

interface Props { fixed: Row | null; moveable: Row; }

/** One planet's comparison row: three even, centered columns — glyph | Fixed | Moveable. */
function CoordinateRowBase({ fixed, moveable }: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const label =
    `${moveable.key}, now ${moveable.sign} ${moveable.dms}` +
    (fixed ? `, natal ${fixed.sign} ${fixed.dms}` : "");
  return (
    <View style={s.row} accessible accessibilityLabel={label}>
      <View style={s.cell}>
        <Text style={s.planet}>{textGlyph(moveable.glyph)}</Text>
      </View>
      <View style={s.vline} />
      <View style={s.cell}>
        {fixed ? (
          <Text style={s.pos}><Text style={s.sign}>{textGlyph(fixed.signGlyph)}</Text> {fixed.dms}</Text>
        ) : (
          <Text style={s.empty}>—</Text>
        )}
      </View>
      <View style={s.vline} />
      <View style={s.cell}>
        <Text style={s.pos}><Text style={s.sign}>{textGlyph(moveable.signGlyph)}</Text> {moveable.dms}</Text>
      </View>
    </View>
  );
}
export const CoordinateRow = memo(CoordinateRowBase);

const makeStyles = (p: Palette) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border },
  cell: { flex: 1, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  vline: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: p.border },
  planet: { color: p.text, fontFamily: GLYPH_FONT, fontSize: 26, textAlign: "center" },
  pos: { color: p.text, fontSize: 20, textAlign: "center" },
  sign: { fontFamily: GLYPH_FONT },
  empty: { color: p.textDim, fontSize: 20, textAlign: "center" },
});
