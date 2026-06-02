import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import type { Palette, PlanetKey } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { PACES } from "../../lib/chartModel";
import type { Mode, TimeFormat, CompareView, ThemeMode, Vis, Layer } from "../../lib/chartModel";
import { padHour } from "../../lib/readout";
import type { ChartClock } from "../../hooks/useChartClock";
import { Segmented } from "../Segmented";
import { VisGrid } from "./VisGrid";
import { ZonedMomentField } from "./ZonedMomentField";

interface Props {
  clock: ChartClock;
  timeFormat: TimeFormat;
  onTimeFormat: (f: TimeFormat) => void;
  showMajor: boolean;
  onToggleMajor: () => void;
  showMinor: boolean;
  onToggleMinor: () => void;
  themeMode: ThemeMode;
  onTheme: (m: ThemeMode) => void;
  vis: Vis;
  onToggleVis: (key: PlanetKey | "all", layer: Layer) => void;
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
const THEMES: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "auto", label: "Auto" },
];

const iosPicker = Platform.OS === "ios";

/** A bordered, labelled container — mirrors the web Panel's <fieldset>/<legend> blocks. */
function Section({ label, children }: { label: string; children: ReactNode }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <View style={styles.section}>
      <Text style={styles.legend}>{label}</Text>
      {children}
    </View>
  );
}

export function ChartControls({
  clock, timeFormat, onTimeFormat, showMajor, onToggleMajor, showMinor, onToggleMinor,
  themeMode, onTheme, vis, onToggleVis,
}: Props) {
  const { palette: pal } = useTheme();
  const styles = useMemo(() => makeStyles(pal), [pal]);
  const {
    mode, setMode, momentMs, setMomentMs,
    rangeStart, setRangeStart, rangeEnd, setRangeEnd,
    playing, togglePlay, loop, toggleLoop, rate, setRate, resetPlay,
    compareA, setCompareA, compareB, setCompareB, compareView, setCompareView,
  } = clock;

  return (
    <View>
      <Section label="View">
        <Segmented options={MODES} value={mode} onChange={setMode} wrap />
      </Section>

      {mode === "moment" ? (
        <Section label="Pick a date & time">
          <DateField label="Moment" valueMs={momentMs} onChange={setMomentMs} withTime timeFormat={timeFormat} />
        </Section>
      ) : null}

      {mode === "range" ? (
        <Section label="Time range">
          <ZonedMomentField label="From" moment={rangeStart} onChange={setRangeStart} timeFormat={timeFormat} />
          <ZonedMomentField label="To" moment={rangeEnd} onChange={setRangeEnd} timeFormat={timeFormat} />
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
          <ZonedMomentField label="Chart A" moment={compareA} onChange={setCompareA} timeFormat={timeFormat} />
          <ZonedMomentField label="Chart B" moment={compareB} onChange={setCompareB} timeFormat={timeFormat} />
          <Text style={styles.note}>
            Each chart's time is read in its own timezone — set them independently to compare across zones.
          </Text>
        </Section>
      ) : null}

      <Section label="Clock">
        <Segmented options={FORMATS} value={timeFormat} onChange={onTimeFormat} />
      </Section>

      <Section label="Theme">
        <Segmented options={THEMES} value={themeMode} onChange={onTheme} />
      </Section>

      <Section label="Glyphs">
        <VisGrid vis={vis} onToggle={onToggleVis} />
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
  label, valueMs, onChange, withTime = false, timeFormat,
}: {
  label: string;
  valueMs: number;
  onChange: (ms: number) => void;
  withTime?: boolean;
  timeFormat: TimeFormat;
}) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const d = new Date(valueMs);
  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const timeOpts: Intl.DateTimeFormatOptions = timeFormat === "24h"
    ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { hour: "2-digit", minute: "2-digit", hour12: true };
  const timeStr = padHour(d.toLocaleTimeString(undefined, timeOpts));

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
            textColor={p.text}
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
            textColor={p.text}
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

const makeStyles = (p: Palette) => StyleSheet.create({
  section: {
    borderColor: p.border, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12,
    marginTop: 12,
  },
  legend: { color: p.seclabel, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 },
  subLegend: { marginTop: 14 },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  rowTight: { flexDirection: "row", gap: 8 },
  flex1: { flex: 1 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: "center", backgroundColor: p.bg, borderColor: p.border, borderWidth: 1 },
  btnOn: { backgroundColor: p.live, borderColor: p.live },
  btnPrimary: { backgroundColor: p.live, borderColor: p.live },
  btnText: { color: p.text, fontSize: 14, fontWeight: "600" },
  btnPrimaryText: { color: p.bg, fontSize: 14, fontWeight: "700" },
  btnTextOn: { color: p.bg, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 14, borderColor: p.border, borderWidth: 1 },
  chipOn: { backgroundColor: p.live, borderColor: p.live },
  chipText: { color: p.textDim, fontSize: 12 },
  chipTextOn: { color: p.bg, fontWeight: "700" },
  field: { marginTop: 4 },
  fieldLabel: { color: p.textDim, fontSize: 12, marginBottom: 4, marginTop: 6 },
  input: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  inputText: { color: p.text, fontSize: 15 },
  pickerWrap: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 8, marginTop: 6 },
  pickerDone: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 10 },
  pickerDoneText: { color: p.live, fontSize: 15, fontWeight: "600" },
  note: { color: p.textDim, fontSize: 12, marginTop: 10, lineHeight: 17 },
});
