import { useEffect, useState } from "react";
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, StyleSheet, Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { NIGHT } from "@astro/engine";
import type { BirthData } from "@astro/engine";
import { searchPlaces } from "../lib/geocode";
import type { PlaceResult } from "../lib/geocode";
import { offsetHoursAt } from "../lib/timezone";
import { validateBirth } from "../lib/birthValidation";

interface Props {
  visible: boolean;
  initial: BirthData;
  onSave: (b: BirthData) => void;
  onCancel: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateToStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeToStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const strToDate = (date: string, time: string) => {
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  return new Date(Y || 2000, (M || 1) - 1, D || 1, h || 0, m || 0);
};

export function BirthForm({ visible, initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial.name ?? "");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [lat, setLat] = useState<number | null>(initial.lat);
  const [lon, setLon] = useState<number | null>(initial.lon);
  const [tzOffset, setTzOffset] = useState<number | null>(initial.tzOffset);
  const [ianaTz, setIanaTz] = useState<string | null>(null);
  const [placeLabel, setPlaceLabel] = useState(initial.placeLabel ?? "");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the draft each time the modal (re)opens.
  useEffect(() => {
    if (!visible) return;
    setName(initial.name ?? "");
    setDate(initial.date);
    setTime(initial.time);
    setLat(initial.lat);
    setLon(initial.lon);
    setTzOffset(initial.tzOffset);
    setIanaTz(null);
    setPlaceLabel(initial.placeLabel ?? "");
    setQuery("");
    setResults([]);
    setSearchError(null);
    setError(null);
  }, [visible, initial]);

  // Debounced place search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); setSearchError(null); return; }
    setSearching(true);
    setSearchError(null);
    const id = setTimeout(async () => {
      try {
        const r = await searchPlaces(q);
        setResults(r);
        setSearchError(r.length === 0 ? "No matches — try a larger nearby city, or use Advanced." : null);
      } catch {
        setResults([]);
        setSearchError("Couldn't reach place search. Check your connection or use Advanced.");
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [query]);

  // Re-derive the offset if the date/time changes after a place was picked (DST varies by date).
  useEffect(() => {
    if (ianaTz) setTzOffset(offsetHoursAt(date, time, ianaTz));
  }, [date, time, ianaTz]);

  function pickPlace(p: PlaceResult) {
    setLat(p.lat);
    setLon(p.lon);
    setIanaTz(p.timezone);
    setPlaceLabel(p.label);
    setTzOffset(offsetHoursAt(date, time, p.timezone));
    setResults([]);
    setQuery("");
  }

  function onSavePress() {
    const res = validateBirth({ name, date, time, lat, lon, tzOffset, placeLabel });
    if (!res.ok) { setError(res.error); return; }
    onSave(res.birth);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Your birth</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName}
              placeholder="You" placeholderTextColor={NIGHT.textDim} />

            <Text style={styles.label}>Birth date</Text>
            <Pressable style={styles.input} onPress={() => setShowDate(true)}>
              <Text style={styles.inputText}>{date}</Text>
            </Pressable>
            {showDate && (
              <DateTimePicker
                value={strToDate(date, time)} mode="date" display="default"
                onChange={(_e: DateTimePickerEvent, d?: Date) => { setShowDate(Platform.OS === "ios"); if (d) setDate(dateToStr(d)); }}
              />
            )}

            <Text style={styles.label}>Birth time</Text>
            <Pressable style={styles.input} onPress={() => setShowTime(true)}>
              <Text style={styles.inputText}>{time}</Text>
            </Pressable>
            {showTime && (
              <DateTimePicker
                value={strToDate(date, time)} mode="time" display="default"
                onChange={(_e: DateTimePickerEvent, d?: Date) => { setShowTime(Platform.OS === "ios"); if (d) setTime(timeToStr(d)); }}
              />
            )}

            <Text style={styles.label}>Place</Text>
            {placeLabel ? (
              <Text style={styles.resolved}>📍 {placeLabel}{ianaTz ? `  ·  ${ianaTz}` : ""}</Text>
            ) : null}
            <TextInput style={styles.input} value={query} onChangeText={setQuery}
              placeholder="Search a city…" placeholderTextColor={NIGHT.textDim} autoCorrect={false} />
            {searching ? <ActivityIndicator color={NIGHT.live} style={styles.spinner} /> : null}
            {searchError ? <Text style={styles.hint}>{searchError}</Text> : null}
            {results.map((r, i) => (
              <Pressable key={`${r.lat},${r.lon},${i}`} style={styles.result} onPress={() => pickPlace(r)}>
                <Text style={styles.resultText}>{r.label}</Text>
              </Pressable>
            ))}

            <Pressable onPress={() => setAdvanced((a) => !a)} style={styles.advancedToggle}>
              <Text style={styles.advancedText}>{advanced ? "▾" : "▸"} Advanced (manual coordinates)</Text>
            </Pressable>
            {advanced ? (
              <View>
                <Text style={styles.label}>Latitude</Text>
                <TextInput style={styles.input} keyboardType="numbers-and-punctuation"
                  value={lat === null ? "" : String(lat)}
                  onChangeText={(t) => setLat(t === "" || t === "-" ? null : Number(t))}
                  placeholder="-90 to 90" placeholderTextColor={NIGHT.textDim} />
                <Text style={styles.label}>Longitude</Text>
                <TextInput style={styles.input} keyboardType="numbers-and-punctuation"
                  value={lon === null ? "" : String(lon)}
                  onChangeText={(t) => setLon(t === "" || t === "-" ? null : Number(t))}
                  placeholder="-180 to 180" placeholderTextColor={NIGHT.textDim} />
                <Text style={styles.label}>UTC offset (hours)</Text>
                <TextInput style={styles.input} keyboardType="numbers-and-punctuation"
                  value={tzOffset === null ? "" : String(tzOffset)}
                  onChangeText={(t) => setTzOffset(t === "" || t === "-" ? null : Number(t))}
                  placeholder="e.g. -6 or 5.5" placeholderTextColor={NIGHT.textDim} />
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel}>
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.save]} onPress={onSavePress}>
              <Text style={styles.btnText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: NIGHT.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, maxHeight: "88%" },
  scroll: { marginBottom: 12 },
  title: { color: NIGHT.text, fontSize: 20, fontWeight: "600", marginBottom: 10 },
  label: { color: NIGHT.seclabel, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: NIGHT.text, fontSize: 16, justifyContent: "center" },
  inputText: { color: NIGHT.text, fontSize: 16 },
  resolved: { color: NIGHT.live, fontSize: 13, marginBottom: 6 },
  spinner: { marginVertical: 6 },
  hint: { color: NIGHT.textDim, fontSize: 13, marginTop: 6 },
  result: { paddingVertical: 10, paddingHorizontal: 8, borderBottomColor: NIGHT.border, borderBottomWidth: 1 },
  resultText: { color: NIGHT.text, fontSize: 15 },
  advancedToggle: { marginTop: 16, paddingVertical: 6 },
  advancedText: { color: NIGHT.textDim, fontSize: 14 },
  error: { color: "#ff6b6b", fontSize: 14, marginTop: 12 },
  footer: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  cancel: { backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1 },
  save: { backgroundColor: NIGHT.border },
  btnText: { color: NIGHT.text, fontSize: 16, fontWeight: "600" },
});
