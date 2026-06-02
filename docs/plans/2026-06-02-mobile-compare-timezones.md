# Compare Per-Chart Timezones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Each Compare chart picks its own timezone; the entered date/time is wall-clock *in* that zone (→ different instants → different wheels).

**Architecture:** A Compare chart becomes `CompareMoment = {date,time,zone}`; the instant is derived via `zonedInstant` (= `Date.UTC(...) − offsetHoursAt·3.6e6`). New `ZonedMomentField` (date + time + `OffsetSelect`) per chart. Helpers/type/component land first (green); the coupled `useChartClock` ↔ `ChartControls` ↔ `App` change is one keystone commit.

**Tech Stack:** Expo SDK 54 / RN 0.81 / React 19, `@astro/engine`. No new deps.

**Reference spec:** `docs/specs/2026-06-02-mobile-compare-timezones-design.md`

---

### Task 1: `lib/timezone.ts` — `zonedInstant` + `zoneAbbr` (TDD)

**Files:** Modify `apps/mobile/lib/timezone.ts`, `apps/mobile/lib/timezone.test.ts`.

- [ ] **Step 1: Failing tests** — append to `timezone.test.ts` (add `zonedInstant` to the import):

```ts
test("zonedInstant: same wall-clock in different zones differs by the offset gap", () => {
  const ny = zonedInstant("2026-07-01", "15:00", "America/New_York"); // EDT = UTC-4
  const tk = zonedInstant("2026-07-01", "15:00", "Asia/Tokyo");        // JST = UTC+9
  assert.equal((ny - tk) / 3600000, 13); // NY instant is 13h later than Tokyo for same wall-clock
});
test("zonedInstant: matches the UTC math for a fixed offset", () => {
  // 1992-07-29 14:28 America/Chicago (CDT, UTC-5) -> 19:28 UTC
  const ms = zonedInstant("1992-07-29", "14:28", "America/Chicago");
  assert.equal(new Date(ms).toISOString(), "1992-07-29T19:28:00.000Z");
});
```

- [ ] **Step 2: Run — fails** (`pnpm --filter @astro/mobile test`).

- [ ] **Step 3: Implement** — add `import { formatOffset } from "@astro/engine";` at the top of `timezone.ts`, then append:

```ts
/** Absolute instant (ms) for a wall-clock date/time interpreted in `zone`. */
export function zonedInstant(date: string, time: string, zone: string): number {
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  return Date.UTC(Y, M - 1, D, h || 0, m || 0) - offsetHoursAt(date, time, zone) * 3600000;
}

/** Short zone label for a moment, e.g. "CDT"; falls back to "UTC-5" if unavailable. */
export function zoneAbbr(date: string, time: string, zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone, timeZoneName: "short", hour: "2-digit",
    }).formatToParts(new Date(zonedInstant(date, time, zone)));
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    if (name && !/^GMT[+-]/.test(name)) return name;
  } catch { /* fall through */ }
  return formatOffset(offsetHoursAt(date, time, zone));
}
```

- [ ] **Step 4: Run — passes.**
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/timezone.ts apps/mobile/lib/timezone.test.ts
git commit -m "feat(mobile): zonedInstant + zoneAbbr timezone helpers (TDD)"
```

---

### Task 2: `CompareMoment` type

**Files:** Modify `apps/mobile/lib/chartModel.ts`.

- [ ] **Step 1:** After `CompareView`, add:

```ts
/** A Compare chart's moment: wall-clock date/time interpreted in an IANA zone. */
export interface CompareMoment { date: string; time: string; zone: string; }
```

- [ ] **Step 2:** Typecheck. **Commit**

```bash
git add apps/mobile/lib/chartModel.ts
git commit -m "feat(mobile): CompareMoment type (date/time/zone)"
```

---

### Task 3: `ZonedMomentField` component (new)

**Files:** Create `apps/mobile/components/chart/ZonedMomentField.tsx`.

- [ ] **Step 1: Write it** — date + time native pickers (editing strings) + `OffsetSelect`, themed:

```tsx
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

export function ZonedMomentField({ label, moment, onChange, timeFormat }: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const d = fromStr(moment.date, moment.time);
  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
```

- [ ] **Step 2:** Typecheck. **Commit**

```bash
git add apps/mobile/components/chart/ZonedMomentField.tsx
git commit -m "feat(mobile): ZonedMomentField — date + time + timezone for one Compare chart"
```

---

### Task 4: `cmpCaption(moment, timeFormat)`

**Files:** Modify `apps/mobile/lib/readout.ts`.

- [ ] **Step 1:** Replace the existing `cmpCaption(ms, birth, timeFormat)` with a moment-based one
(add `import { zoneAbbr } from "./timezone";` and `CompareMoment` to the chartModel type import):

```ts
/** Per-wheel Compare caption: "Mon D YYYY · hh:mm AM · CDT" from the chart's {date,time,zone}. */
export function cmpCaption(moment: CompareMoment, timeFormat: TimeFormat): string {
  const [Y, M, D] = moment.date.split("-").map(Number);
  const [h, m] = moment.time.split(":").map(Number);
  const d = new Date(Y || 2000, (M || 1) - 1, D || 1, h || 0, m || 0);
  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const opts: Intl.DateTimeFormatOptions = timeFormat === "24h"
    ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { hour: "2-digit", minute: "2-digit", hour12: true };
  const timeStr = padHour(d.toLocaleTimeString(undefined, opts));
  return `${dateStr} · ${timeStr} · ${zoneAbbr(moment.date, moment.time, moment.zone)}`;
}
```

- [ ] **Step 2:** Typecheck will FAIL at `App.tsx` (old `cmpCaption(ms, birth, tf)` call) — expected; fixed in Task 5. **Commit**:

```bash
git add apps/mobile/lib/readout.ts
git commit -m "feat(mobile): cmpCaption takes a CompareMoment (date/time/zone)"
```

---

### Task 5: Keystone — `useChartClock` model + `ChartControls` + `App`

**Files:** Modify `hooks/useChartClock.ts`, `components/chart/ChartControls.tsx`, `App.tsx`.

- [ ] **Step 1: `useChartClock`** — import `zonedInstant` from `../lib/timezone`, `CompareMoment` type, and `type { BirthData }`. Change signature to `useChartClock(birthMs: number, birth: BirthData)`. Replace the compare-state block:

```ts
const localZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; } };
const birthMoment = (b: BirthData): CompareMoment => ({ date: b.date, time: b.time, zone: b.ianaTz ?? localZone() });
const nowMoment = (): CompareMoment => {
  const d = new Date(); const z = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`, time: `${z(d.getHours())}:${z(d.getMinutes())}`, zone: localZone() };
};
// state:
const [compareA, setCompareA] = useState<CompareMoment>(() => birthMoment(birth));
const [compareB, setCompareB] = useState<CompareMoment>(() => nowMoment());
const [compareView, setCompareView] = useState<CompareView>("both");
const compareAMs = useMemo(() => zonedInstant(compareA.date, compareA.time, compareA.zone), [compareA]);
const compareBMs = useMemo(() => zonedInstant(compareB.date, compareB.time, compareB.zone), [compareB]);
```

Replace the old `useEffect(() => { setCompareA(birthMs); }, [birthMs])` with:
```ts
useEffect(() => { setCompareA(birthMoment(birth)); }, [birth.date, birth.time, birth.ianaTz]);
```
Update the `ChartClock` interface: `compareA: CompareMoment; setCompareA: (m: CompareMoment) => void; compareB: CompareMoment; setCompareB: (m: CompareMoment) => void; compareAMs: number; compareBMs: number;` (the old number `setCompareA/B(ms)` are gone), keep `compareView`/`setCompareView`. Return the new members.

- [ ] **Step 2: `ChartControls`** — destructure `compareA, setCompareA, compareB, setCompareB, compareView, setCompareView` from `clock`. Import `ZonedMomentField`. Replace the Compare `Section` body (the two old `DateField`s) with:

```tsx
<Text style={styles.fieldLabel}>View</Text>
<Segmented options={CVIEWS} value={compareView} onChange={setCompareView} />
<ZonedMomentField label="Chart A" moment={compareA} onChange={setCompareA} timeFormat={timeFormat} />
<ZonedMomentField label="Chart B" moment={compareB} onChange={setCompareB} timeFormat={timeFormat} />
<Text style={styles.note}>Each chart's time is read in its own timezone — set them independently.</Text>
```

- [ ] **Step 3: `App`** — `const clock = useChartClock(birthMs, birth);`. Replace the compare captions:
```ts
const cmpA = cmpCaption(clock.compareA, timeFormat);
const cmpB = cmpCaption(clock.compareB, timeFormat);
```
(`compareAPos`/`compareBPos` already derive from `clock.compareAMs`/`compareBMs` — unchanged. `CompareView` props unchanged.)

- [ ] **Step 4: Typecheck + tests** — `pnpm --filter @astro/mobile typecheck`; `pnpm --filter @astro/mobile test`. Expected: exit 0; green.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/hooks/useChartClock.ts apps/mobile/components/chart/ChartControls.tsx apps/mobile/App.tsx
git commit -m "feat(mobile): Compare per-chart timezones (wall-clock interpreted in each zone)"
```

---

### Task 6: Verify

- [ ] `pnpm --filter @astro/mobile typecheck`; `pnpm --filter @astro/mobile test`; `pnpm --filter @astro/engine test` — green.
- [ ] `cd apps/mobile && npx expo export --platform android` — bundles.
- [ ] Web `/browse` (390×844): Compare → set Chart A and Chart B to the **same** date/time with **different** zones → the wheels' planets differ; captions show each zone abbrev. Change a chart's zone → its wheel shifts, wall-clock unchanged.
- [ ] Hand off for device.

---

## Completion
After all tasks verify and the user confirms (or per go-ahead): use superpowers:finishing-a-development-branch — verify tests, then merge (PR, mirroring prior slices).
