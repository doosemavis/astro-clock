import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { formatOffset } from "@astro/engine";
import type { Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";
import { offsetHoursAt } from "../lib/timezone";

interface Props {
  /** The currently-selected IANA zone (from Place search or this picker), or null. */
  valueZone: string | null;
  date: string; // YYYY-MM-DD — offsets are derived/shown DST-aware for the birth date
  time: string; // HH:MM
  onChange: (zone: string) => void;
}

/**
 * Representative IANA zones (city-labelled), one per common UTC offset, sorted west→east.
 * Picking one sets the birth's *timezone*; the caller derives the actual offset DST-aware
 * via offsetHoursAt — so a summer Central birth resolves to CDT (UTC-5), not CST (UTC-6).
 * This is why the control is a zone picker, not a raw-offset picker: a bare offset can't
 * know whether daylight saving was in effect on the birth date.
 */
const ZONES: { zone: string; city: string }[] = [
  { zone: "Pacific/Pago_Pago", city: "Pago Pago" },
  { zone: "Pacific/Honolulu", city: "Honolulu" },
  { zone: "America/Anchorage", city: "Anchorage" },
  { zone: "America/Los_Angeles", city: "Los Angeles" },
  { zone: "America/Denver", city: "Denver" },
  { zone: "America/Chicago", city: "Chicago" },
  { zone: "America/New_York", city: "New York" },
  { zone: "America/Halifax", city: "Halifax" },
  { zone: "America/St_Johns", city: "St. John's" },
  { zone: "America/Sao_Paulo", city: "São Paulo" },
  { zone: "Atlantic/Azores", city: "Azores" },
  { zone: "Europe/London", city: "London" },
  { zone: "Europe/Paris", city: "Paris" },
  { zone: "Europe/Athens", city: "Athens" },
  { zone: "Africa/Cairo", city: "Cairo" },
  { zone: "Europe/Moscow", city: "Moscow" },
  { zone: "Asia/Tehran", city: "Tehran" },
  { zone: "Asia/Dubai", city: "Dubai" },
  { zone: "Asia/Kabul", city: "Kabul" },
  { zone: "Asia/Karachi", city: "Karachi" },
  { zone: "Asia/Kolkata", city: "Mumbai" },
  { zone: "Asia/Kathmandu", city: "Kathmandu" },
  { zone: "Asia/Dhaka", city: "Dhaka" },
  { zone: "Asia/Yangon", city: "Yangon" },
  { zone: "Asia/Bangkok", city: "Bangkok" },
  { zone: "Asia/Singapore", city: "Singapore" },
  { zone: "Asia/Tokyo", city: "Tokyo" },
  { zone: "Australia/Adelaide", city: "Adelaide" },
  { zone: "Australia/Sydney", city: "Sydney" },
  { zone: "Pacific/Auckland", city: "Auckland" },
];

const cityOf = (zone: string): string =>
  ZONES.find((z) => z.zone === zone)?.city ?? zone.split("/").pop()?.replace(/_/g, " ") ?? zone;

export function OffsetSelect({ valueZone, date, time, onChange }: Props) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [open, setOpen] = useState(false);
  const labelFor = (zone: string): string => `${formatOffset(offsetHoursAt(date, time, zone))} · ${cityOf(zone)}`;

  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={valueZone ? styles.value : styles.placeholder}>
          {valueZone ? labelFor(valueZone) : "Select a timezone…"}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={() => { /* swallow taps inside the card */ }}>
            <Text style={styles.title}>Birth timezone</Text>
            <ScrollView style={styles.list}>
              {ZONES.map((z) => {
                const on = z.zone === valueZone;
                return (
                  <Pressable
                    key={z.zone}
                    style={[styles.row, on && styles.rowOn]}
                    onPress={() => { onChange(z.zone); setOpen(false); }}
                  >
                    <Text style={[styles.rowText, on && styles.rowTextOn]}>{labelFor(z.zone)}</Text>
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

const makeStyles = (p: Palette) => StyleSheet.create({
  field: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  value: { color: p.text, fontSize: 16 },
  placeholder: { color: p.textDim, fontSize: 16 },
  chevron: { color: p.textDim, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", paddingHorizontal: 28 },
  card: { backgroundColor: p.panel, borderColor: p.border, borderWidth: 1, borderRadius: 14, paddingVertical: 12, maxHeight: "70%" },
  title: { color: p.text, fontSize: 16, fontWeight: "600", paddingHorizontal: 16, paddingBottom: 8 },
  list: { paddingHorizontal: 8 },
  row: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8 },
  rowOn: { backgroundColor: p.border },
  rowText: { color: p.text, fontSize: 15 },
  rowTextOn: { color: p.live, fontWeight: "700" },
});
