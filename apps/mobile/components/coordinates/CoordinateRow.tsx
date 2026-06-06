import { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { GLYPH_FONT } from "../chart/palette";
import { textGlyph } from "../../lib/glyph";
import type { CoordinateRow as Row } from "../../lib/coordinateRows";

interface Props { fixed: Row | null; moveable: Row; }

/** One planet's comparison row: glyph (once) + centered Fixed | Moveable cells.
 *  A trailing spacer mirrors the planet gutter so the divider sits dead-center. */
function CoordinateRowBase({ fixed, moveable }: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const label =
    `${moveable.key}, now ${moveable.sign} ${moveable.dms}` +
    (fixed ? `, natal ${fixed.sign} ${fixed.dms}` : "");
  return (
    <View style={s.row} accessible accessibilityLabel={label}>
      <Text style={s.planet}>{textGlyph(moveable.glyph)}</Text>
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
      <View style={s.side} />
    </View>
  );
}
export const CoordinateRow = memo(CoordinateRowBase);

const SIDE = 32;

const makeStyles = (p: Palette) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border },
  planet: { color: p.text, fontFamily: GLYPH_FONT, fontSize: 26, width: SIDE, textAlign: "center" },
  side: { width: SIDE },
  cell: { flex: 1, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  vline: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: p.border },
  pos: { color: p.text, fontSize: 20, textAlign: "center" },
  sign: { fontFamily: GLYPH_FONT },
  empty: { color: p.textDim, fontSize: 20, textAlign: "center" },
});
