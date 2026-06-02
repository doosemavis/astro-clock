import { useState } from "react";
import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { NIGHT } from "@astro/engine";
import { PACES } from "../../lib/chartModel";
import type { Mode, TimeFormat, CompareView } from "../../lib/chartModel";
import { padHour } from "../../lib/readout";
import type { ChartClock } from "../../hooks/useChartClock";
import { Segmented } from "../Segmented";

interface Props {
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
  { key: "compare", label: "Compare" },
];
const FORMATS: { key: TimeFormat; label: string }[] = [
  { key: "12h", label: "12h" },
  { key: "24h", label: "24h" },
];
const CVIEWS: { key: CompareView; label: string }[] = [
  { key: "both", label: "Both" },
  { key: "pages", label: "Page" },
  { key: "flip", label: "Flip" },
];

const iosPicker = Platform.OS === "ios";

/** A bordered, labelled container — mirrors the web Panel's <fieldset>/<legend> blocks. */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.legend}>{label}</Text>
      {children}
    </View>
  );
}

export function ChartControls({
  clock, timeFormat, onTimeFormat, showMajor, onToggleMajor, showMinor, onToggleMinor,
}: Props) {
  const {
    mode, setMode, momentMs, setMomentMs,
    rangeStartMs, setRangeStartMs, rangeEndMs, setRangeEndMs,
    playing, togglePlay, loop, toggleLoop, rate, setRate, resetPlay,
    compareAMs, setCompareA, compareBMs, setCompareB, compareView, setCompareView,
  } = clock;

  return (
    <View>
      <Section label="View">
        <Segmented options={MODES} value={mode} onChange={setMode} wrap />
      </Section>

      {mode === "moment" ? (
        <Section label="Pick a date & time">
          <DateField label="Moment" valueMs={momentMs} onChange={setMomentMs} withTime />
        </Section>
      ) : null}

      {mode === "range" ? (
        <Section label="Time range">
          <DateField label="From" valueMs={rangeStartMs} onChange={setRangeStartMs} />
          <DateField label="To" valueMs={rangeEndMs} onChange={setRangeEndMs} />
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={togglePlay}>
              <Text style={styles.btnPrimaryText}>{playing ? "❚❚ Pause" : "▶ Play"}</Text>
            </Pressable>
            <Pressable style={[styles.btn, loop && styles.btnOn]} onPress={toggleLoop}>
              <Text style={[styles.btnText, loop && styles.btnTextOn]}>Loop</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={resetPlay}>
              <Text style={styles.btnText}>↺ Restart</Text>
            </Pressable>
          </View>
          <Text style={[styles.legend, styles.subLegend]}>Speed</Text>
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
        </Section>
      ) : null}

      {mode === "compare" ? (
        <Section label="Compare two charts">
          <Text style={styles.fieldLabel}>View</Text>
          <Segmented options={CVIEWS} value={compareView} onChange={setCompareView} />
          <DateField label="Chart A" valueMs={compareAMs} onChange={setCompareA} withTime />
          <DateField label="Chart B" valueMs={compareBMs} onChange={setCompareB} withTime />
          <Text style={styles.note}>
            Chart A starts at your birth moment, Chart B at now — change either to compare two date/times.
          </Text>
        </Section>
      ) : null}

      <Section label="Clock">
        <Segmented options={FORMATS} value={timeFormat} onChange={onTimeFormat} />
      </Section>

      <Section label="Aspects">
        <View style={styles.rowTight}>
          <Pressable style={[styles.btn, showMajor && styles.btnOn]} onPress={onToggleMajor}>
            <Text style={[styles.btnText, showMajor && styles.btnTextOn]}>Major</Text>
          </Pressable>
          <Pressable style={[styles.btn, showMinor && styles.btnOn]} onPress={onToggleMinor}>
            <Text style={[styles.btnText, showMinor && styles.btnTextOn]}>Minor</Text>
          </Pressable>
        </View>
      </Section>
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
  const timeStr = padHour(d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }));

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.rowTight}>
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
  section: {
    borderColor: NIGHT.border, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12,
    marginTop: 12,
  },
  legend: { color: NIGHT.seclabel, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  subLegend: { marginTop: 14 },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  rowTight: { flexDirection: "row", gap: 8 },
  flex1: { flex: 1 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: "center", backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1 },
  btnOn: { backgroundColor: NIGHT.live, borderColor: NIGHT.live },
  btnPrimary: { backgroundColor: NIGHT.live, borderColor: NIGHT.live },
  btnText: { color: NIGHT.text, fontSize: 14, fontWeight: "600" },
  btnPrimaryText: { color: NIGHT.bg, fontSize: 14, fontWeight: "700" },
  btnTextOn: { color: NIGHT.bg, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 14, borderColor: NIGHT.border, borderWidth: 1 },
  chipOn: { backgroundColor: NIGHT.live, borderColor: NIGHT.live },
  chipText: { color: NIGHT.textDim, fontSize: 12 },
  chipTextOn: { color: NIGHT.bg, fontWeight: "700" },
  field: { marginTop: 4 },
  fieldLabel: { color: NIGHT.textDim, fontSize: 12, marginBottom: 4, marginTop: 6 },
  input: { backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  inputText: { color: NIGHT.text, fontSize: 15 },
  pickerWrap: { backgroundColor: NIGHT.bg, borderColor: NIGHT.border, borderWidth: 1, borderRadius: 8, marginTop: 6 },
  pickerDone: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 10 },
  pickerDoneText: { color: NIGHT.live, fontSize: 15, fontWeight: "600" },
  note: { color: NIGHT.textDim, fontSize: 12, marginTop: 10, lineHeight: 17 },
});
