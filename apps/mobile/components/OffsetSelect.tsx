import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NIGHT, OFFSETS, OFFSET_CITY, formatOffset } from "@astro/engine";

interface Props {
  value: number | null;
  onChange: (v: number) => void;
}

const cityFor = (off: number): string => OFFSET_CITY[String(off)] ?? "";
const labelFor = (off: number): string => {
  const city = cityFor(off);
  return city ? `${formatOffset(off)} · ${city}` : formatOffset(off);
};

/** A tappable UTC-offset picker: every offset (−12…+14, incl. half/quarter hours) paired
 *  with a representative city (e.g. "UTC-6 · Chicago"). Opens a modal list over the form. */
export function OffsetSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={value == null ? styles.placeholder : styles.value}>
          {value == null ? "Select a timezone…" : labelFor(value)}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => { /* swallow taps inside the card */ }}>
            <Text style={styles.title}>UTC offset</Text>
            <ScrollView style={styles.list}>
              {OFFSETS.map((off) => {
                const on = off === value;
                return (
                  <Pressable
                    key={off}
                    style={[styles.row, on && styles.rowOn]}
                    onPress={() => { onChange(off); setOpen(false); }}
                  >
                    <Text style={[styles.rowText, on && styles.rowTextOn]}>{labelFor(off)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  value: { color: NIGHT.text, fontSize: 16 },
  placeholder: { color: NIGHT.textDim, fontSize: 16 },
  chevron: { color: NIGHT.textDim, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: 28 },
  card: { backgroundColor: NIGHT.panel, borderColor: NIGHT.border, borderWidth: 1, borderRadius: 14, paddingVertical: 12, maxHeight: "70%" },
  title: { color: NIGHT.text, fontSize: 16, fontWeight: "600", paddingHorizontal: 16, paddingBottom: 8 },
  list: { paddingHorizontal: 8 },
  row: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8 },
  rowOn: { backgroundColor: NIGHT.border },
  rowText: { color: NIGHT.text, fontSize: 15 },
  rowTextOn: { color: NIGHT.live, fontWeight: "700" },
});
