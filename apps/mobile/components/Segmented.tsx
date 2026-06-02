import { Pressable, StyleSheet, Text, View } from "react-native";
import { NIGHT } from "@astro/engine";

interface Option<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}

/** A single-select pill row styled with the NIGHT palette (selected = live gold). */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.seg, on && styles.segOn]}>
            <Text style={[styles.txt, on && styles.txtOn]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 3, backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1, borderRadius: 10, padding: 3 },
  seg: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: "center" },
  segOn: { backgroundColor: NIGHT.live },
  txt: { color: NIGHT.textDim, fontSize: 13 },
  txtOn: { color: NIGHT.bg, fontWeight: "700" },
});
