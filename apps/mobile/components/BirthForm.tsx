import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  ActivityIndicator, StyleSheet, Platform, KeyboardAvoidingView, Animated,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import type { BirthData, Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";
import { Segmented } from "./Segmented";
import type { TimeFormat } from "../lib/chartModel";
import { searchPlaces } from "../lib/geocode";
import type { PlaceResult } from "../lib/geocode";
import { offsetHoursAt } from "../lib/timezone";
import { validateBirth } from "../lib/birthValidation";
import { OffsetSelect } from "./OffsetSelect";

interface Props {
  visible: boolean;
  initial: BirthData;
  onSave: (b: BirthData) => void;
  onCancel: () => void;
  /** Seeds the form's own 12h/24h toggle (independently changeable inside the form). */
  timeFormat?: TimeFormat;
}

const TIME_FORMATS: { key: TimeFormat; label: string }[] = [
  { key: "12h", label: "12h" },
  { key: "24h", label: "24h" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const dateToStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeToStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const strToDate = (date: string, time: string) => {
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  return new Date(Y || 2000, (M || 1) - 1, D || 1, h || 0, m || 0);
};

export function BirthForm({ visible, initial, onSave, onCancel, timeFormat = "12h" }: Props) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
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
  const [birthTf, setBirthTf] = useState<TimeFormat>(timeFormat); // form's own 12h/24h, seeded from the app

  // Drop-from-top animation. Keep the Modal mounted through the close tween so the
  // panel slides back up instead of vanishing. translateY rides the measured panel
  // height so it starts fully off-screen above the top edge.
  const drop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [panelH, setPanelH] = useState(800);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(drop, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    } else {
      Animated.timing(drop, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, drop]);

  // Reset the draft each time the modal (re)opens.
  useEffect(() => {
    if (!visible) return;
    setDate(initial.date);
    setTime(initial.time);
    setLat(initial.lat);
    setLon(initial.lon);
    setTzOffset(initial.tzOffset);
    setIanaTz(initial.ianaTz ?? null);
    setPlaceLabel(initial.placeLabel ?? "");
    setQuery("");
    setResults([]);
    setSearchError(null);
    setError(null);
    setShowDate(false);
    setShowTime(false);
    setAdvanced(false);
    setBirthTf(timeFormat);
  }, [visible, initial, timeFormat]);

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

  // Selecting a place fills lat/lon, the IANA zone, and the derived offset, so the
  // Advanced coordinates always mirror the chosen Place.
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
    const res = validateBirth({ name: initial.name, date, time, lat, lon, tzOffset, placeLabel, ianaTz: ianaTz ?? undefined });
    if (!res.ok) { setError(res.error); return; }
    onSave(res.birth);
  }

  const iosPicker = Platform.OS === "ios";
  const translateY = drop.interpolate({ inputRange: [0, 1], outputRange: [-panelH, 0] });
  // Display the birth time per the form's own 12h/24h toggle; the stored value stays HH:MM.
  const showTimeStr = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    const dd = new Date(2000, 0, 1, h || 0, m || 0);
    const opts: Intl.DateTimeFormatOptions = birthTf === "24h"
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : { hour: "2-digit", minute: "2-digit", hour12: true };
    return dd.toLocaleTimeString(undefined, opts).replace(/^(\d):/, "0$1:");
  };

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.root} behavior={iosPicker ? "padding" : undefined}>
        <Animated.View style={[styles.backdrop, { opacity: drop }]} pointerEvents="none" />
        <Animated.View
          onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
          style={[styles.sheet, { transform: [{ translateY }] }]}
        >
          <Text style={styles.title}>Your birth</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <Text style={styles.label}>Birth date</Text>
            <Pressable style={styles.input} onPress={() => { setShowTime(false); setShowDate((s) => !s); }}>
              <Text style={styles.inputText}>{date}</Text>
            </Pressable>
            {showDate && (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={strToDate(date, time)} mode="date"
                  display={iosPicker ? "spinner" : "default"}
                  textColor={p.text}
                  onChange={(_e: DateTimePickerEvent, d?: Date) => { if (!iosPicker) setShowDate(false); if (d) setDate(dateToStr(d)); }}
                />
                {iosPicker ? (
                  <Pressable style={styles.pickerDone} onPress={() => setShowDate(false)}>
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            <Text style={styles.label}>Birth time</Text>
            <Pressable style={styles.input} onPress={() => { setShowDate(false); setShowTime((s) => !s); }}>
              <Text style={styles.inputText}>{showTimeStr(time)}</Text>
            </Pressable>
            {showTime && (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={strToDate(date, time)} mode="time"
                  display={iosPicker ? "spinner" : "default"}
                  textColor={p.text}
                  onChange={(_e: DateTimePickerEvent, d?: Date) => { if (!iosPicker) setShowTime(false); if (d) setTime(timeToStr(d)); }}
                />
                {iosPicker ? (
                  <Pressable style={styles.pickerDone} onPress={() => setShowTime(false)}>
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            <Text style={styles.label}>Clock</Text>
            <Segmented options={TIME_FORMATS} value={birthTf} onChange={setBirthTf} />

            <Text style={styles.label}>Place</Text>
            {placeLabel ? (
              <Text style={styles.resolved}>📍 {placeLabel}{ianaTz ? `  ·  ${ianaTz}` : ""}</Text>
            ) : null}
            <TextInput style={styles.input} value={query} onChangeText={setQuery}
              placeholder="Search a city…" placeholderTextColor={p.textDim} autoCorrect={false} />
            {searching ? <ActivityIndicator color={p.live} style={styles.spinner} /> : null}
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
                  placeholder="-90 to 90" placeholderTextColor={p.textDim} />
                <Text style={styles.label}>Longitude</Text>
                <TextInput style={styles.input} keyboardType="numbers-and-punctuation"
                  value={lon === null ? "" : String(lon)}
                  onChangeText={(t) => setLon(t === "" || t === "-" ? null : Number(t))}
                  placeholder="-180 to 180" placeholderTextColor={p.textDim} />
                <Text style={styles.label}>Birth timezone</Text>
                <OffsetSelect valueZone={ianaTz} date={date} time={time} onChange={setIanaTz} />
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
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-start" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: p.panel,
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "ios" ? 54 : 28,
    paddingBottom: 18,
    maxHeight: "90%",
  },
  scroll: { marginBottom: 12 },
  title: { color: p.text, fontSize: 20, fontWeight: "600", marginBottom: 10 },
  label: { color: p.seclabel, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: p.text, fontSize: 16, justifyContent: "center" },
  inputText: { color: p.text, fontSize: 16 },
  pickerWrap: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 8, marginTop: 6 },
  pickerDone: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 10 },
  pickerDoneText: { color: p.live, fontSize: 15, fontWeight: "600" },
  resolved: { color: p.live, fontSize: 13, marginBottom: 6 },
  spinner: { marginVertical: 6 },
  hint: { color: p.textDim, fontSize: 13, marginTop: 6 },
  result: { paddingVertical: 10, paddingHorizontal: 8, borderBottomColor: p.border, borderBottomWidth: 1 },
  resultText: { color: p.text, fontSize: 15 },
  advancedToggle: { marginTop: 16, paddingVertical: 6 },
  advancedText: { color: p.textDim, fontSize: 14 },
  error: { color: "#ff6b6b", fontSize: 14, marginTop: 12 },
  footer: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  cancel: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1 },
  save: { backgroundColor: p.border },
  btnText: { color: p.text, fontSize: 16, fontWeight: "600" },
});
