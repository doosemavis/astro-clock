import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { NIGHT } from "@astro/engine";
import type { BirthData } from "@astro/engine";
import { PACES } from "../../lib/chartModel";
import type { Mode, TimeFormat } from "../../lib/chartModel";
import { fmtDate, fmtTime, readoutTz } from "../../lib/readout";
import type { ChartClock } from "../../hooks/useChartClock";
import { Segmented } from "../Segmented";

interface Props {
  birth: BirthData;
  clock: ChartClock;
  timeFormat: TimeFormat;
  onTimeFormat: (f: TimeFormat) => void;
  showMajor: boolean;
  onToggleMajor: () => void;
  showMinor: boolean;
  onToggleMinor: () => void;
}

const MODES: { key: Mode; label: string }[] = [
  { key: "birth", label: "Birth" },
  { key: "now", label: "Now" },
  { key: "moment", label: "Date" },
  { key: "range", label: "Range" },
];
const FORMATS: { key: TimeFormat; label: string }[] = [
  { key: "12h", label: "12h" },
  { key: "24h", label: "24h" },
];

const iosPicker = Platform.OS === "ios";

export function ChartControls({
  birth, clock, timeFormat, onTimeFormat, showMajor, onToggleMajor, showMinor, onToggleMinor,
}: Props) {
  const {
    mode, setMode, displayInstant, momentMs, setMomentMs,
    rangeStartMs, setRangeStartMs, rangeEndMs, setRangeEndMs,
    playing, togglePlay, loop, toggleLoop, rate, setRate, resetPlay,
  } = clock;

  const readout =
    `${fmtDate(displayInstant, mode, birth)}  ·  ${fmtTime(displayInstant, mode, birth, timeFormat)}  ${readoutTz(displayInstant, mode, birth)}`;

  return (
    <View>
      <Text style={styles.readout}>{readout}</Text>
      <Segmented options={MODES} value={mode} onChange={setMode} />

      {mode === "moment" ? (
        <View style={styles.section}>
          <DateField label="Moment" valueMs={momentMs} onChange={setMomentMs} withTime />
        </View>
      ) : null}

      {mode === "range" ? (
        <View style={styles.section}>
          <DateField label="From" valueMs={rangeStartMs} onChange={setRangeStartMs} />
          <DateField label="To" valueMs={rangeEndMs} onChange={setRangeEndMs} />
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={togglePlay}>
              <Text style={styles.btnPrimaryText}>{playing ? "❚❚ Pause" : "▶ Play"}</Text>
            </Pressable>
            <Pressable style={[styles.btn, loop && styles.btnOn]} onPress={toggleLoop}>
              <Text style={styles.btnText}>Loop</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={resetPlay}>
              <Text style={styles.btnText}>↺</Text>
            </Pressable>
          </View>
          <Text style={styles.seclabel}>Speed</Text>
          <View style={styles.chips}>
            {PACES.map((p) => {
              const on = p.rate === rate;
              return (
                <Pressable key={p.label} onPress={() => setRate(p.rate)} style={[styles.chip, on && styles.chipOn]}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.seclabel}>Clock</Text>
        <Segmented options={FORMATS} value={timeFormat} onChange={onTimeFormat} />
      </View>

      <View style={styles.section}>
        <Text style={styles.seclabel}>Aspects</Text>
        <View style={styles.row}>
          <Pressable style={[styles.btn, showMajor && styles.btnOn]} onPress={onToggleMajor}>
            <Text style={styles.btnText}>Major</Text>
          </Pressable>
          <Pressable style={[styles.btn, showMinor && styles.btnOn]} onPress={onToggleMinor}>
            <Text style={styles.btnText}>Minor</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** A date (and optionally time) field using the native picker — date-only for Range
 *  bounds, date+time for the Date moment. Mirrors the Slice-2 BirthForm picker pattern. */
function DateField({
  label, valueMs, onChange, withTime = false,
}: {
  label: string;
  valueMs: number;
  onChange: (ms: number) => void;
  withTime?: boolean;
}) {
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const d = new Date(valueMs);
  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const timeStr = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <View style={styles.field}>
      <Text style={styles.seclabel}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={[styles.input, styles.flex1]} onPress={() => { setShowTime(false); setShowDate((s) => !s); }}>
          <Text style={styles.inputText}>{dateStr}</Text>
        </Pressable>
        {withTime ? (
          <Pressable style={[styles.input, styles.flex1]} onPress={() => { setShowDate(false); setShowTime((s) => !s); }}>
            <Text style={styles.inputText}>{timeStr}</Text>
          </Pressable>
        ) : null}
      </View>
      {showDate ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={d} mode="date"
            display={iosPicker ? "spinner" : "default"}
            textColor={NIGHT.text}
            onChange={(_e: DateTimePickerEvent, picked?: Date) => {
              if (!iosPicker) setShowDate(false);
              if (picked) {
                const next = new Date(valueMs);
                next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
                onChange(next.getTime());
              }
            }}
          />
          {iosPicker ? (
            <Pressable style={styles.pickerDone} onPress={() => setShowDate(false)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {showTime ? (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            value={d} mode="time"
            display={iosPicker ? "spinner" : "default"}
            textColor={NIGHT.text}
            onChange={(_e: DateTimePickerEvent, picked?: Date) => {
              if (!iosPicker) setShowTime(false);
              if (picked) {
                const next = new Date(valueMs);
                next.setHours(picked.getHours(), picked.getMinutes());
                onChange(next.getTime());
              }
            }}
          />
          {iosPicker ? (
            <Pressable style={styles.pickerDone} onPress={() => setShowTime(false)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { color: NIGHT.text, fontSize: 15, fontWeight: "600", textAlign: "center", marginBottom: 10 },
  section: { marginTop: 14 },
  seclabel: { color: NIGHT.seclabel, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  flex1: { flex: 1 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: "center", backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1 },
  btnOn: { backgroundColor: NIGHT.border },
  btnPrimary: { backgroundColor: NIGHT.live, borderColor: NIGHT.live },
  btnText: { color: NIGHT.text, fontSize: 14, fontWeight: "600" },
  btnPrimaryText: { color: NIGHT.bg, fontSize: 14, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 14, borderColor: NIGHT.border, borderWidth: 1 },
  chipOn: { backgroundColor: NIGHT.live, borderColor: NIGHT.live },
  chipText: { color: NIGHT.textDim, fontSize: 12 },
  chipTextOn: { color: NIGHT.bg, fontWeight: "700" },
  field: { marginTop: 10 },
  input: { backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  inputText: { color: NIGHT.text, fontSize: 15 },
  pickerWrap: { backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1, borderRadius: 8, marginTop: 6 },
  pickerDone: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 10 },
  pickerDoneText: { color: NIGHT.live, fontSize: 15, fontWeight: "600" },
});
