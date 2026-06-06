import { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { GLYPH_FONT } from "../chart/palette";
import { textGlyph } from "../../lib/glyph";
import type { CoordinateRow as Row } from "../../lib/coordinateRows";

interface Props { fixed: Row | null; moveable: Row; showName?: boolean; }

/** "sun" -> "Sun" — the PlanetKey is already the lowercase planet name. */
const nameOf = (key: string): string => key.charAt(0).toUpperCase() + key.slice(1);

/** One planet's comparison row: three even, centered columns — glyph | Fixed | Moveable.
 *  Vertical padding lives on the cells (not the row) so the divider Views span the full
 *  row height and join into continuous vertical gridlines down the whole table. */
function CoordinateRowBase({ fixed, moveable, showName }: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const label =
    `${moveable.key}: ` +
    (fixed ? `${fixed.sign} ${fixed.dms}, ` : "") +
    `${moveable.sign} ${moveable.dms}`;
  return (
    <View style={s.row} accessible accessibilityLabel={label}>
      <View style={s.glyphCell}>
        {showName ? (
          <Text style={s.planetName}>{nameOf(moveable.key)}</Text>
        ) : (
          <Text style={s.planet}>{textGlyph(moveable.glyph)}</Text>
        )}
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
  row: { flexDirection: "row", alignItems: "stretch", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border },
  glyphCell: { width: 76, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  cell: { flex: 1, paddingHorizontal: 6, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  vline: { width: StyleSheet.hairlineWidth, backgroundColor: p.border },
  planet: { color: p.text, fontFamily: GLYPH_FONT, fontSize: 26, textAlign: "center" },
  planetName: { color: p.text, fontSize: 14, fontWeight: "600", textAlign: "center" },
  pos: { color: p.text, fontSize: 20, textAlign: "center" },
  sign: { fontFamily: GLYPH_FONT },
  empty: { color: p.textDim, fontSize: 20, textAlign: "center" },
});
