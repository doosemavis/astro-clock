# Mobile Living Chart (3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile chart live — the moveable glyphs tick in real time (Now), jump to a picked instant (Date), and animate across a window (Range) — driven from a bottom sheet, with 12h/24h and major/minor aspect toggles.

**Architecture:** Port the web's *pure* view-model glue (`chartModel`, `useAnimationFrame`) into `apps/mobile`, add a `useChartClock` hook that turns mode/playback state into a single `displayInstant`, and re-author the control surface for touch as a bottom sheet (`Animated` + `PanResponder`, no new deps). `positions(displayInstant)` feeds the existing `ChartWheel`; only `LiveLayer` + `AspectLayer` re-render.

**Tech Stack:** Expo / React Native 0.81 + React 19, `react-native-svg`, `@react-native-community/datetimepicker` (already a dep), `@astro/engine` (pure). Tests via `node --test --experimental-strip-types`.

**Note on file split (refines the spec):** the spec listed the readout formatters inside `chartModel.ts`. They are split into `lib/readout.ts` instead, because they import engine *values* (`tzAbbrev`, `formatOffset`) at runtime — keeping them out of `chartModel.ts` lets the pure helpers be unit-tested under the strip-types runner without loading the engine graph (only a type-only `BirthData` import remains, which is erased).

---

### Task 1: `chartModel.ts` — pure view-model helpers (TDD)

**Files:**
- Create: `apps/mobile/lib/chartModel.ts`
- Test: `apps/mobile/lib/chartModel.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/chartModel.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDate, PACES, actualOffset, HR, DY } from "./chartModel.ts";
import type { BirthData } from "@astro/engine";

const BIRTH: BirthData = {
  name: "Test", date: "1992-07-29", time: "14:28",
  tzOffset: -6, isDst: true, lat: 35.84, lon: -90.7, placeLabel: "Jonesboro",
};

test("resolveDate: birth and moment return their exact instants", () => {
  assert.equal(resolveDate("birth", 1000, 2000, 3000, 9000, 0.5).getTime(), 1000);
  assert.equal(resolveDate("moment", 1000, 2000, 3000, 9000, 0.5).getTime(), 2000);
});

test("resolveDate: range interpolates linearly by pos", () => {
  assert.equal(resolveDate("range", 0, 0, 1000, 3000, 0).getTime(), 1000);
  assert.equal(resolveDate("range", 0, 0, 1000, 3000, 0.5).getTime(), 2000);
  assert.equal(resolveDate("range", 0, 0, 1000, 3000, 1).getTime(), 3000);
});

test("resolveDate: now is the current instant", () => {
  const before = Date.now();
  const got = resolveDate("now", 0, 0, 0, 0, 0).getTime();
  assert.ok(got >= before && got <= Date.now() + 1000);
});

test("PACES: 6 speeds spanning 1 hour/sec to 1 month/sec", () => {
  assert.equal(PACES.length, 6);
  assert.equal(PACES[0].rate, HR);
  assert.equal(PACES[5].rate, 30 * DY);
});

test("actualOffset: adds the DST hour when isDst", () => {
  assert.equal(actualOffset(BIRTH), -5);
  assert.equal(actualOffset({ ...BIRTH, isDst: false }), -6);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @astro/mobile test`
Expected: FAIL — `Cannot find module './chartModel.ts'`.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/mobile/lib/chartModel.ts`:

```ts
// Pure view-model glue for the living chart: playback paces, mode→instant resolution.
// No engine *values* are imported (only the erased BirthData type), so this module is
// unit-testable under the strip-types runner. Readout formatting lives in ./readout.ts.
// Ported from apps/web/components/Chart/chartModel.ts (Compare + theme helpers removed).
import type { BirthData } from "@astro/engine";

export type Mode = "birth" | "now" | "moment" | "range";
export type TimeFormat = "12h" | "24h";
export interface Pace {
  label: string;
  rate: number; // sim-time ms advanced per real second
  note: string;
}

export const HR = 3600 * 1000;
export const DY = 24 * HR;

/** Range playback speeds — fast = ~1 month/sec, scaled down (prototype PACES). */
export const PACES: Pace[] = [
  { label: "Xtra-slow", rate: 1 * HR, note: "≈ 1 hour / sec" },
  { label: "Slow", rate: 6 * HR, note: "≈ 6 hours / sec" },
  { label: "Medium", rate: 12 * HR, note: "≈ 12 hours / sec" },
  { label: "Medium-fast", rate: 1 * DY, note: "≈ 1 day / sec" },
  { label: "Fast", rate: 7 * DY, note: "≈ 1 week / sec" },
  { label: "Xtra-fast", rate: 30 * DY, note: "≈ 1 month / sec" },
];

/** Standard offset + daylight-saving hour (prototype actualOff). */
export const actualOffset = (b: BirthData): number => b.tzOffset + (b.isDst ? 1 : 0);

/**
 * Resolve the moment the moveable glyphs should show, given the current mode.
 * Birth = the fixed UTC instant; Now = real time; Moment = a picked instant;
 * Range = linear interpolation across [start,end] by pos (0..1).
 */
export function resolveDate(
  mode: Mode, birthMs: number, momentMs: number,
  rangeStart: number, rangeEnd: number, pos: number,
): Date {
  if (mode === "birth") return new Date(birthMs);
  if (mode === "now") return new Date();
  if (mode === "moment") return new Date(momentMs);
  return new Date(rangeStart + pos * (rangeEnd - rangeStart));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS (all Slice-2 tests + the 5 new chartModel tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/chartModel.ts apps/mobile/lib/chartModel.test.ts
git commit -m "feat(mobile): chartModel — pure mode/pace view-model helpers"
```

---

### Task 2: `readout.ts` — engine-backed date/time/tz formatters

**Files:**
- Create: `apps/mobile/lib/readout.ts`

No unit test: these wrap `Intl` + engine `tzAbbrev`/`formatOffset`, are locale-dependent, and import engine *values* at runtime. They are verified by the web-target render and on-device readout (Task 9). Ported verbatim from `apps/web/components/Chart/chartModel.ts`.

- [ ] **Step 1: Write the implementation**

Create `apps/mobile/lib/readout.ts`:

```ts
// Readout formatting for the living chart: the date/time/tz label under the wheel.
// Imports engine values (tzAbbrev, formatOffset) so it is verified via render, not unit
// tests. Ported verbatim from apps/web/components/Chart/chartModel.ts.
import { tzAbbrev, formatOffset } from "@astro/engine";
import type { BirthData } from "@astro/engine";
import { actualOffset, HR } from "./chartModel";
import type { Mode, TimeFormat } from "./chartModel";

// Reconstruct the wall-clock time as it was, where it was (birth zone).
function birthShift(instantMs: number, birth: BirthData): Date {
  return new Date(instantMs + actualOffset(birth) * HR);
}

/** Date label. Birth mode uses the birth zone; everything else the viewer's local zone. */
export function fmtDate(date: Date, mode: Mode, birth: BirthData): string {
  if (mode === "birth")
    return birthShift(date.getTime(), birth).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
    });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Time label, birth-zone vs. local per mode; 24h uses the h23 cycle (00:00, not 24:00). */
export function fmtTime(date: Date, mode: Mode, birth: BirthData, timeFormat: TimeFormat): string {
  const opts: Intl.DateTimeFormatOptions =
    timeFormat === "24h"
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : { hour: "2-digit", minute: "2-digit", hour12: true };
  if (mode === "birth")
    return birthShift(date.getTime(), birth).toLocaleTimeString(undefined, { ...opts, timeZone: "UTC" });
  return date.toLocaleTimeString(undefined, opts);
}

/** Viewer's local timezone abbreviation, e.g. "EST" (prototype localTzAbbr). */
export function localTzAbbr(date: Date): string {
  try {
    const s = date.toLocaleTimeString("en-US", { timeZoneName: "short" });
    const m = s.match(/[A-Z]{2,5}$/);
    if (m) return m[0];
  } catch {
    /* fall through to numeric offset */
  }
  return formatOffset(-date.getTimezoneOffset() / 60);
}

/** Timezone shown in the readout: birth zone in Birth mode, else the viewer's. */
export function readoutTz(date: Date, mode: Mode, birth: BirthData): string {
  return mode === "birth" ? tzAbbrev(birth.tzOffset, birth.isDst) : localTzAbbr(date);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/readout.ts
git commit -m "feat(mobile): readout — birth/local date-time-tz formatters"
```

---

### Task 3: `useAnimationFrame.ts` — rAF loop (port)

**Files:**
- Create: `apps/mobile/lib/useAnimationFrame.ts`

Ported verbatim from `apps/web/components/Chart/useAnimationFrame.ts`. React Native supports `requestAnimationFrame`. No unit test (rAF timing); verified by Range playback (Task 9).

- [ ] **Step 1: Write the implementation**

Create `apps/mobile/lib/useAnimationFrame.ts`:

```ts
import { useEffect, useRef } from "react";

/**
 * Runs `callback(dtSeconds)` on every animation frame while `active`.
 * dt is clamped to 0.25s so a backgrounded app can't fast-forward Range mode
 * (mirrors the prototype's `if (dt > 0.25) dt = 0.25`).
 *
 * The callback is held in a ref so changing it never restarts the rAF loop —
 * only `active` toggling starts/stops it.
 */
export function useAnimationFrame(callback: (dt: number) => void, active = true): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (t: number) => {
      if (last === null) last = t;
      let dt = (t - last) / 1000;
      last = t;
      if (dt > 0.25) dt = 0.25;
      cbRef.current(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/useAnimationFrame.ts
git commit -m "feat(mobile): useAnimationFrame — clamped rAF loop (port)"
```

---

### Task 4: `useChartClock.ts` — mode/playback state → `displayInstant`

**Files:**
- Create: `apps/mobile/hooks/useChartClock.ts`

Owns the interactive time state and produces a single `displayInstant`. Now ticks at 1 Hz; Range advances via rAF while playing; Birth/Date are static. No unit test (timers/rAF + React state); verified by mode switching and Range playback (Task 9).

- [ ] **Step 1: Write the implementation**

Create `apps/mobile/hooks/useChartClock.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useAnimationFrame } from "../lib/useAnimationFrame";
import { DY, resolveDate } from "../lib/chartModel";
import type { Mode } from "../lib/chartModel";

export interface ChartClock {
  mode: Mode;
  setMode: (m: Mode) => void;
  displayInstant: Date;
  momentMs: number; setMomentMs: (ms: number) => void;
  rangeStartMs: number; setRangeStartMs: (ms: number) => void;
  rangeEndMs: number; setRangeEndMs: (ms: number) => void;
  playing: boolean; togglePlay: () => void;
  loop: boolean; toggleLoop: () => void;
  rate: number; setRate: (r: number) => void;
  resetPlay: () => void;
}

/**
 * Owns the living chart's time state and yields one `displayInstant` for the wheel.
 * Mirrors the web Chart.tsx animation logic; the one departure is Now, which ticks at
 * 1 Hz here (a setInterval) rather than every animation frame — real planetary motion
 * per second is imperceptible, so 1 Hz is smooth and battery-friendly.
 */
export function useChartClock(birthMs: number): ChartClock {
  const [mode, setModeRaw] = useState<Mode>("now");
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(DY); // 1 day / sec
  const [momentMs, setMomentMs] = useState(birthMs);
  const [rangeStartMs, setRangeStartMs] = useState(birthMs);
  const [rangeEndMs, setRangeEndMs] = useState(birthMs);
  const posRef = useRef(0);
  const [displayInstant, setDisplayInstant] = useState<Date>(() => new Date());

  // Seed now-based defaults once on mount (Range end + Date moment start at "now").
  useEffect(() => {
    const now = Date.now();
    setRangeEndMs(now);
    setMomentMs(now);
  }, []);

  // Range start tracks the birth instant (re-seeds when the birth changes).
  useEffect(() => { setRangeStartMs(birthMs); }, [birthMs]);

  // Birth / Date: static frame.
  useEffect(() => {
    if (mode === "birth") setDisplayInstant(new Date(birthMs));
    else if (mode === "moment") setDisplayInstant(new Date(momentMs));
  }, [mode, birthMs, momentMs]);

  // Now: tick once per second.
  useEffect(() => {
    if (mode !== "now") return;
    setDisplayInstant(new Date());
    const id = setInterval(() => setDisplayInstant(new Date()), 1000);
    return () => clearInterval(id);
  }, [mode]);

  // Range, paused or bounds changed: hold the frame at the current position.
  useEffect(() => {
    if (mode !== "range" || playing) return;
    setDisplayInstant(resolveDate("range", birthMs, momentMs, rangeStartMs, rangeEndMs, posRef.current));
  }, [mode, playing, birthMs, momentMs, rangeStartMs, rangeEndMs]);

  // Range, playing: advance pos each frame and resolve the instant.
  useAnimationFrame(
    useCallback((dt: number) => {
      const span = rangeEndMs - rangeStartMs;
      if (span > 0) posRef.current += (rate * dt) / span;
      if (posRef.current >= 1) {
        if (loop) posRef.current = 0;
        else { posRef.current = 1; setPlaying(false); }
      }
      setDisplayInstant(resolveDate("range", birthMs, momentMs, rangeStartMs, rangeEndMs, posRef.current));
    }, [loop, rate, birthMs, momentMs, rangeStartMs, rangeEndMs]),
    mode === "range" && playing,
  );

  const setMode = useCallback((m: Mode) => { setModeRaw(m); setPlaying(false); }, []);
  const togglePlay = useCallback(() => {
    if (posRef.current >= 1) posRef.current = 0;
    setPlaying((p) => !p);
  }, []);
  const toggleLoop = useCallback(() => setLoop((v) => !v), []);
  const resetPlay = useCallback(() => {
    posRef.current = 0;
    setPlaying(false);
    setDisplayInstant(resolveDate("range", birthMs, momentMs, rangeStartMs, rangeEndMs, 0));
  }, [birthMs, momentMs, rangeStartMs, rangeEndMs]);

  return {
    mode, setMode, displayInstant,
    momentMs, setMomentMs, rangeStartMs, setRangeStartMs, rangeEndMs, setRangeEndMs,
    playing, togglePlay, loop, toggleLoop, rate, setRate, resetPlay,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/hooks/useChartClock.ts
git commit -m "feat(mobile): useChartClock — mode/playback state to displayInstant"
```

---

### Task 5: `Segmented.tsx` — reusable segmented control

**Files:**
- Create: `apps/mobile/components/Segmented.tsx`

- [ ] **Step 1: Write the implementation**

Create `apps/mobile/components/Segmented.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/Segmented.tsx
git commit -m "feat(mobile): Segmented — reusable single-select pill row"
```

---

### Task 6: Aspect major/minor toggle (AspectLayer + ChartWheel)

**Files:**
- Modify: `apps/mobile/components/chart/AspectLayer.tsx`
- Modify: `apps/mobile/components/chart/ChartWheel.tsx`

Switch `AspectLayer` from drawing every detected aspect to the engine's tier-filtered `findAspects(pos, { major, minor })`, and thread `showMajor`/`showMinor` through `ChartWheel`. With both flags `true` (the defaults) the output is identical to today (both APIs return the first matching def per pair).

- [ ] **Step 1: Replace `AspectLayer.tsx`**

Overwrite `apps/mobile/components/chart/AspectLayer.tsx`:

```tsx
import { memo } from "react";
import type { ReactElement } from "react";
import { G, Line } from "react-native-svg";
import { R, polar, findAspects, aspectColor } from "@astro/engine";
import type { Positions } from "@astro/engine";

interface Props {
  positions: Positions;
  showMajor?: boolean;
  showMinor?: boolean;
}

// Lines between aspecting planet pairs, filtered by tier via the engine's findAspects.
// Colored for the dark theme (aspectColor(def, 0)); mirrors the web AspectLayer.
function AspectLayerBase({ positions, showMajor = true, showMinor = true }: Props) {
  const lines: ReactElement[] = findAspects(positions, { major: showMajor, minor: showMinor }).map(
    ({ a, b, def }) => {
      const [x1, y1] = polar(R.aspect, positions[a]);
      const [x2, y2] = polar(R.aspect, positions[b]);
      return (
        <Line
          key={`${a}-${b}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={aspectColor(def, 0)}
          strokeWidth={def.width}
          opacity={def.opacity}
          strokeDasharray={def.dash || undefined}
        />
      );
    },
  );
  return <G>{lines}</G>;
}

export const AspectLayer = memo(AspectLayerBase);
```

- [ ] **Step 2: Thread the flags through `ChartWheel.tsx`**

In `apps/mobile/components/chart/ChartWheel.tsx`, extend the `Props` interface and the destructured signature, and pass the flags to `<AspectLayer>`:

```tsx
interface Props {
  natalPositions: Positions;
  livePositions: Positions;
  curvedLabels?: boolean;
  showMajor?: boolean;
  showMinor?: boolean;
}

// ...
function ChartWheelBase({ natalPositions, livePositions, curvedLabels = true, showMajor = true, showMinor = true }: Props) {
```

and change the AspectLayer line inside the `<Svg>` from:

```tsx
        <AspectLayer positions={livePositions} />
```

to:

```tsx
        <AspectLayer positions={livePositions} showMajor={showMajor} showMinor={showMinor} />
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/chart/AspectLayer.tsx apps/mobile/components/chart/ChartWheel.tsx
git commit -m "feat(mobile): AspectLayer major/minor tier filtering via findAspects"
```

---

### Task 7: `BottomSheet.tsx` — collapse/expand sheet (no new deps)

**Files:**
- Create: `apps/mobile/components/BottomSheet.tsx`

A bottom-anchored sheet built on `PanResponder` + state (both RN built-ins). Tap the handle or drag up/down to expand/collapse. Collapsed shows ~the readout + mode switcher (rendered first by the child); expanded grows to a scrollable 70% of screen height. Dismissing (collapse) only hides the lower controls — it never changes mode or stops Range playback.

- [ ] **Step 1: Write the implementation**

Create `apps/mobile/components/BottomSheet.tsx`:

```tsx
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { PanResponder, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { NIGHT } from "@astro/engine";

interface Props {
  children: ReactNode;
}

/** Bottom-anchored control sheet. Tap the handle or drag (>24px) to expand/collapse.
 *  Collapsed reveals only the top of its content (readout + mode switcher); expanded
 *  scrolls up to 70% of the screen. No gesture library — PanResponder is built in. */
export function BottomSheet({ children }: Props) {
  const [expanded, setExpanded] = useState(false);
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8,
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -24) setExpanded(true);
        else if (g.dy > 24) setExpanded(false);
      },
    }),
  ).current;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.sheet, expanded ? styles.sheetExpanded : styles.sheetCollapsed]}>
        <View {...pan.panHandlers}>
          <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={12} style={styles.handleHit}>
            <View style={styles.handle} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: NIGHT.panel,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopColor: NIGHT.border, borderTopWidth: 1,
    paddingHorizontal: 16, paddingBottom: 22,
  },
  sheetCollapsed: { maxHeight: 150 },
  sheetExpanded: { maxHeight: "70%" },
  handleHit: { alignItems: "center", paddingVertical: 8 },
  handle: { width: 34, height: 4, borderRadius: 2, backgroundColor: NIGHT.border },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/BottomSheet.tsx
git commit -m "feat(mobile): BottomSheet — tap/drag collapse-expand (no deps)"
```

---

### Task 8: `ChartControls.tsx` — the sheet's contents

**Files:**
- Create: `apps/mobile/components/chart/ChartControls.tsx`

Renders the readout, the mode switcher, the per-mode controls (Date picker / Range From-To + transport + speed), and the 12h/24h + Major/Minor toggles. Consumes the `ChartClock` from `useChartClock`. The date fields reuse the Slice-2 native-picker pattern (date + optional time, iOS spinner + Done, Android dialog). Range bounds are date-only (range playback spans days+, so intraday start time is noise); the Date moment is date + time.

- [ ] **Step 1: Write the implementation**

Create `apps/mobile/components/chart/ChartControls.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/chart/ChartControls.tsx
git commit -m "feat(mobile): ChartControls — mode switcher, range transport, toggles"
```

---

### Task 9: Wire `App.tsx` + full verification

**Files:**
- Modify: `apps/mobile/App.tsx`

Replace the one-shot launch snapshot with the `useChartClock`-driven `displayInstant`, add `timeFormat` / `showMajor` / `showMinor` state, and mount the `BottomSheet` + `ChartControls` over the wheel. The birth-edit flow (`BirthForm`) is unchanged.

- [ ] **Step 1: Overwrite `App.tsx`**

Overwrite `apps/mobile/App.tsx`:

```tsx
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFonts, NotoSansSymbols_400Regular } from "@expo-google-fonts/noto-sans-symbols";
import { DEFAULT_BIRTH, birthInstant, positions, NIGHT } from "@astro/engine";
import type { BirthData } from "@astro/engine";
import { GLYPH_FONT } from "./components/chart/palette";
import { ChartWheel } from "./components/chart/ChartWheel";
import { ChartControls } from "./components/chart/ChartControls";
import { BottomSheet } from "./components/BottomSheet";
import { BirthForm } from "./components/BirthForm";
import { useChartClock } from "./hooks/useChartClock";
import type { TimeFormat } from "./lib/chartModel";
import { loadBirth, saveBirth } from "./lib/birthStore";

export default function App() {
  // Gate on the glyph font: rendering planet glyphs before it loads would flash tofu.
  const [fontsLoaded] = useFonts({ [GLYPH_FONT]: NotoSansSymbols_400Regular });
  const [birth, setBirth] = useState<BirthData>(DEFAULT_BIRTH);
  const [editing, setEditing] = useState(false);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("12h");
  const [showMajor, setShowMajor] = useState(true);
  const [showMinor, setShowMinor] = useState(true);

  // Load the saved birth on launch (falls back to DEFAULT_BIRTH).
  useEffect(() => {
    let active = true;
    loadBirth().then((b) => { if (active && b) setBirth(b); });
    return () => { active = false; };
  }, []);

  const birthMs = useMemo(() => birthInstant(birth).getTime(), [birth]);
  const natalPos = useMemo(() => positions(new Date(birthMs)), [birthMs]);
  const clock = useChartClock(birthMs);
  const livePos = useMemo(() => positions(clock.displayInstant), [clock.displayInstant]);

  const displayName = birth.name && birth.name !== "You" ? birth.name : "Your chart";

  function onSave(b: BirthData) {
    setBirth(b);
    saveBirth(b).catch(() => { /* local cache only; ignore write errors */ });
    setEditing(false);
  }

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>MoveStar</Text>
      <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
        <Text style={styles.editText}>{displayName}  ✎</Text>
      </Pressable>
      <View style={styles.stage}>
        {fontsLoaded
          ? <ChartWheel natalPositions={natalPos} livePositions={livePos} showMajor={showMajor} showMinor={showMinor} />
          : <Text style={styles.note}>loading…</Text>}
      </View>
      <BottomSheet>
        <ChartControls
          birth={birth}
          clock={clock}
          timeFormat={timeFormat}
          onTimeFormat={setTimeFormat}
          showMajor={showMajor}
          onToggleMajor={() => setShowMajor((v) => !v)}
          showMinor={showMinor}
          onToggleMinor={() => setShowMinor((v) => !v)}
        />
      </BottomSheet>
      <BirthForm visible={editing} initial={birth} onSave={onSave} onCancel={() => setEditing(false)} />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT.bg, alignItems: "center", paddingTop: 56 },
  brand: { color: NIGHT.text, fontSize: 28, letterSpacing: 5, fontWeight: "600" },
  editBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  editText: { color: NIGHT.live, fontSize: 15, letterSpacing: 1 },
  stage: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  note: { color: NIGHT.textDim, fontSize: 13, letterSpacing: 2 },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 3: Run the unit tests**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS — all Slice-2 tests + the 5 chartModel tests.

- [ ] **Step 4: Bundle for Android (Metro resolution check)**

Run: `cd apps/mobile && npx expo export --platform android`
Expected: bundles with no unresolved-module errors.

- [ ] **Step 5: Web-target smoke via /browse**

Run: `cd apps/mobile && npx expo start --web --port 8082` (background), then use the gstack `/browse` skill on `http://localhost:8082`.
Verify: the wheel renders; tapping the sheet handle expands it; switching **Now → Date → Range** changes the moveable glyphs; in **Range**, **Play** animates the glyphs and **Pause/Loop/↺** work; **Major/Minor** toggles add/remove aspect lines; **12h/24h** changes the readout.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): wire living chart — Now/Date/Range via bottom sheet"
```

- [ ] **Step 7: On-device confirmation (user)**

`cd apps/mobile && pnpm start`, scan the QR in Expo Go, then confirm: Now advances; Date jumps to a picked instant; Range plays/pauses/loops/restarts at each speed; the sheet drags + taps to expand/collapse; 12h/24h + Major/Minor work; relaunch still loads the saved birth.

---

## Completion

After Task 9, use **superpowers:finishing-a-development-branch** to verify tests, then choose merge / PR / keep / discard for `feat/mobile-living-chart-3a`.

Deferred to later sub-slices (do **not** build here): Compare / two-wheel (3b); light/dark/auto theme, sun-altitude day/night sky, and the per-planet glyph visibility grid (3c).
