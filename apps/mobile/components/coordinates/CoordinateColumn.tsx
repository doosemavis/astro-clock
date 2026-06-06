import { View, Text, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { CoordinateRow } from "./CoordinateRow";
import type { CoordinateRow as Row } from "../../lib/coordinateRows";

interface Props {
  title: string;
  rows: Row[] | null;
  emptyHint?: string;
}

/** One titled column (Fixed or Moveable). `rows === null` => empty placeholder. */
export function CoordinateColumn({ title, rows, emptyHint }: Props) {
  const { palette: p } = useTheme();
  const s = makeStyles(p);
  return (
    <View style={s.col}>
      <Text style={s.title}>{title}</Text>
      {rows === null ? (
        <Text style={s.empty}>{emptyHint ?? "No data"}</Text>
      ) : (
        rows.map((r) => <CoordinateRow key={r.key} row={r} />)
      )}
    </View>
  );
}

const makeStyles = (p: Palette) =>
  StyleSheet.create({
    col: { flex: 1 },
    title: {
      color: p.textDim,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 6,
    },
    empty: { color: p.textDim, fontSize: 13, fontStyle: "italic", marginTop: 8 },
  });
