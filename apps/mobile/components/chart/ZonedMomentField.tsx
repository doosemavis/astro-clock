import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { padHour } from "../../lib/readout";
import type { TimeFormat, CompareMoment } from "../../lib/chartModel";
import { OffsetSelect } from "../OffsetSelect";

const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fromStr = (date: string, time: string) => {
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  return new Date(Y || 2000, (M || 1) - 1, D || 1, h || 0, m || 0);
};
const iosPicker = Platform.OS === "ios";

interface Props {
  label: string;
  moment: CompareMoment;
  onChange: (m: CompareMoment) => void;
  timeFormat: TimeFormat;
}

/** One Compare chart's controls: a date picker, a time picker, and a timezone picker.
 *  The date/time are wall-clock IN the chosen zone (the caller derives the instant). */
export function ZonedMomentField({ label, moment, onChange, timeFormat }: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const d = fromStr(moment.date, moment.time);
  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
  const opts: Intl.DateTimeFormatOptions = timeFormat === "24h"
    ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { hour: "2-digit", minute: "2-digit", hour12: true };
  const timeStr = padHour(d.toLocaleTimeString(undefined, opts));

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        <Pressable style={[s.input, s.flex1]} onPress={() => { setShowTime(false); setShowDate((v) => !v); }}>
          <Text style={s.inputText}>{dateStr}</Text>
        </Pressable>
        <Pressable style={[s.input, s.flex1]} onPress={() => { setShowDate(false); setShowTime((v) => !v); }}>
          <Text style={s.inputText}>{timeStr}</Text>
        </Pressable>
      </View>
      {showDate ? (
        <View style={s.pickerWrap}>
          <DateTimePicker value={d} mode="date" display={iosPicker ? "spinner" : "default"} textColor={p.text}
            onChange={(_e: DateTimePickerEvent, picked?: Date) => { if (!iosPicker) setShowDate(false); if (picked) onChange({ ...moment, date: toDateStr(picked) }); }} />
          {iosPicker ? <Pressable style={s.done} onPress={() => setShowDate(false)}><Text style={s.doneText}>Done</Text></Pressable> : null}
        </View>
      ) : null}
      {showTime ? (
        <View style={s.pickerWrap}>
          <DateTimePicker value={d} mode="time" display={iosPicker ? "spinner" : "default"} textColor={p.text}
            onChange={(_e: DateTimePickerEvent, picked?: Date) => { if (!iosPicker) setShowTime(false); if (picked) onChange({ ...moment, time: toTimeStr(picked) }); }} />
          {iosPicker ? <Pressable style={s.done} onPress={() => setShowTime(false)}><Text style={s.doneText}>Done</Text></Pressable> : null}
        </View>
      ) : null}
      <OffsetSelect valueZone={moment.zone} date={moment.date} time={moment.time} onChange={(zone) => onChange({ ...moment, zone })} />
    </View>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  wrap: { marginTop: 8 },
  label: { color: p.textDim, fontSize: 12, marginBottom: 4 },
  row: { flexDirection: "row", gap: 8, marginBottom: 6 },
  flex1: { flex: 1 },
  input: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center" },
  inputText: { color: p.text, fontSize: 15 },
  pickerWrap: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 8, marginBottom: 6 },
  done: { alignSelf: "flex-end", paddingHorizontal: 16, paddingVertical: 10 },
  doneText: { color: p.live, fontSize: 15, fontWeight: "600" },
});
