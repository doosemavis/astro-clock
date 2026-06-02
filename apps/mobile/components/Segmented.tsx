import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";

interface Option<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Let the pills wrap to multiple rows (used by the 5-mode switcher). */
  wrap?: boolean;
}

/** A single-select pill row styled with the NIGHT palette (selected = live gold). */
export function Segmented<T extends string>({ options, value, onChange, wrap = false }: Props<T>) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <View style={[styles.row, wrap && styles.rowWrap]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.seg, wrap && styles.segWrap, on && styles.segOn]}>
            <Text style={[styles.txt, on && styles.txtOn]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  row: { flexDirection: "row", gap: 3, backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, padding: 3 },
  rowWrap: { flexWrap: "wrap" },
  segWrap: { flexBasis: "31%", flexGrow: 1 },
  seg: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: "center" },
  segOn: { backgroundColor: p.live },
  txt: { color: p.textDim, fontSize: 13 },
  txtOn: { color: p.bg, fontWeight: "700" },
});
