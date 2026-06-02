# Mobile Compare (Slice 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **Compare** mode to the mobile living chart — two independent single-moment wheels (Chart A = birth, Chart B = now, each editable), shown either **stacked on one page** or as a **full-size swipe pager**, driven from the existing bottom sheet.

**Architecture:** Port the web's two-wheel model (`apps/web/components/Chart/CompareWheel.tsx` + Compare state in `Chart.tsx`). Reuse the engine verbatim and the existing `Dial` / `AspectLayer` / `LiveLayer` SVG layers. A new `CompareWheel` composes one chart for a single instant; a new `CompareView` arranges the pair (Both = stacked column, Pages = `ScrollView pagingEnabled` + page dots). `useChartClock` gains the two moments + a `compareView` flag. `App.tsx` renders `CompareView` instead of the single `ChartWheel` when `mode === "compare"`.

**Tech Stack:** Expo SDK 54 / React Native 0.81 / React 19, `react-native-svg`, `@astro/engine`. **No new dependencies** — the pager is RN's built-in `ScrollView`; date pickers reuse `@react-native-community/datetimepicker` already in use.

**Reference spec:** `docs/specs/2026-06-02-mobile-compare-3b-design.md`

---

### Task 1: View-model — `Mode` + `CompareView` + `pageIndex` (TDD)

**Files:**
- Modify: `apps/mobile/lib/chartModel.ts`
- Test: `apps/mobile/lib/chartModel.test.ts`

- [ ] **Step 1: Write the failing tests**

Add `pageIndex` to the existing import from `"./chartModel.ts"` at the top of
`apps/mobile/lib/chartModel.test.ts`, then append:

```ts
test("pageIndex: offset 0 → page 0", () => {
  assert.equal(pageIndex(0, 390, 2), 0);
});
test("pageIndex: just under half a page stays on page 0", () => {
  assert.equal(pageIndex(194, 390, 2), 0);
});
test("pageIndex: at half a page rounds to the next page", () => {
  assert.equal(pageIndex(195, 390, 2), 1);
});
test("pageIndex: a full page width → page 1", () => {
  assert.equal(pageIndex(390, 390, 2), 1);
});
test("pageIndex: overscroll clamps to the last page", () => {
  assert.equal(pageIndex(900, 390, 2), 1);
});
test("pageIndex: negative overscroll clamps to 0", () => {
  assert.equal(pageIndex(-50, 390, 2), 0);
});
test("pageIndex: a zero page width is safe (→ 0)", () => {
  assert.equal(pageIndex(100, 0, 2), 0);
});
```

- [ ] **Step 2: Run the tests — they fail**

Run: `pnpm --filter @astro/mobile test`
Expected: FAIL — `pageIndex` is not exported.

- [ ] **Step 3: Implement**

In `apps/mobile/lib/chartModel.ts`, change the `Mode` type and add the new type + helper:

```ts
export type Mode = "birth" | "now" | "moment" | "range" | "compare";
export type TimeFormat = "12h" | "24h";

/** Mobile Compare presentation: both wheels stacked on one page, or a full-size pager. */
export type CompareView = "both" | "pages";
```

Append at the end of the file:

```ts
/** Current page from a horizontal scroll offset — drives the Compare pager's dots.
 *  Rounds to the nearest page and clamps into [0, count-1]; degenerate inputs → 0. */
export function pageIndex(offsetX: number, pageWidth: number, count: number): number {
  if (pageWidth <= 0 || count <= 0) return 0;
  const i = Math.round(offsetX / pageWidth);
  return Math.max(0, Math.min(count - 1, i));
}
```

- [ ] **Step 4: Run the tests — they pass**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS (all prior tests + the 7 new `pageIndex` tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/chartModel.ts apps/mobile/lib/chartModel.test.ts
git commit -m "feat(mobile): chartModel compare types + pageIndex helper (TDD)"
```

---

### Task 2: Caption helper — `cmpCaption`

**Files:**
- Modify: `apps/mobile/lib/readout.ts`

`readout.ts` already imports `BirthData`, `Mode`, `TimeFormat`, and defines `fmtDate` /
`fmtTime` / `readoutTz`. No new imports needed.

- [ ] **Step 1: Append the helper**

Add at the end of `apps/mobile/lib/readout.ts`:

```ts
/** Per-wheel caption for Compare: "Mon D YYYY · hh:mm AM TZ" in the viewer's LOCAL zone
 *  (web parity — formats with "moment" mode). `birth` is unused by "moment" mode but is
 *  required by the shared fmt* signatures; the app's current birth is passed through. */
export function cmpCaption(ms: number, birth: BirthData, timeFormat: TimeFormat): string {
  const d = new Date(ms);
  return `${fmtDate(d, "moment", birth)} · ${fmtTime(d, "moment", birth, timeFormat)} ${readoutTz(d, "moment", birth)}`;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/readout.ts
git commit -m "feat(mobile): cmpCaption — local-zone date/time/tz for a Compare wheel"
```

---

### Task 3: `Dial` — `idPrefix` so two wheels don't share SVG ids

**Files:**
- Modify: `apps/mobile/components/chart/Dial.tsx`

`Dial` defines `<Path id={`acSignArc${s}`}>` in `<Defs>` and references it from `<TextPath
href="#...">`. On web (react-native-web emits real SVG, where `<defs>` ids are
document-global) two `Dial`s would cross-reference. Prefix the id per wheel. `LiveLayer` and
`AspectLayer` use only React `key`s (no SVG ids) and need no change.

- [ ] **Step 1: Add the prop**

Change the `Props` interface and the component signature:

```ts
interface Props {
  curvedLabels?: boolean;
  idPrefix?: string;
}

function DialBase({ curvedLabels = true, idPrefix = "" }: Props) {
```

- [ ] **Step 2: Prefix the arc id**

In the curved-labels branch, change:

```ts
      const id = `acSignArc${s}`;
```

to:

```ts
      const id = `${idPrefix}acSignArc${s}`;
```

(The `<TextPath href={`#${id}`}>` already references `id`, so it inherits the prefix.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0. `ChartWheel` calls `<Dial curvedLabels={curvedLabels} />` — `idPrefix`
defaults to `""`, so the single-wheel render is byte-identical.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/chart/Dial.tsx
git commit -m "feat(mobile): Dial idPrefix prop (collision-free ids for two wheels)"
```

---

### Task 4: `useChartClock` — Compare state

**Files:**
- Modify: `apps/mobile/hooks/useChartClock.ts`

- [ ] **Step 1: Import the type**

Change the type import:

```ts
import type { Mode, CompareView } from "../lib/chartModel";
```

- [ ] **Step 2: Extend the `ChartClock` interface**

Add these members to `interface ChartClock` (after `resetPlay`):

```ts
  compareAMs: number; setCompareA: (ms: number) => void;
  compareBMs: number; setCompareB: (ms: number) => void;
  compareView: CompareView; setCompareView: (v: CompareView) => void;
```

- [ ] **Step 3: Add the state**

After the existing `const [rangeEndMs, setRangeEndMs] = useState(birthMs);` line:

```ts
  const [compareAMs, setCompareA] = useState(birthMs);
  const [compareBMs, setCompareB] = useState<number>(() => Date.now());
  const [compareView, setCompareView] = useState<CompareView>("both");
```

- [ ] **Step 4: Reset Chart A when the birth changes**

After the existing `useEffect(() => { setRangeStartMs(birthMs); }, [birthMs]);`:

```ts
  // Compare's Chart A tracks the birth instant (re-seeds when the birth changes),
  // mirroring the web's applyBirth → setCompareAMs(birthInstant(b)).
  useEffect(() => { setCompareA(birthMs); }, [birthMs]);
```

(No loop runs in Compare — the Now 1 Hz timer and Range rAF are already gated on
`mode === "now"` / `"range"`, so `"compare"` triggers neither.)

- [ ] **Step 5: Return the new members**

Add to the returned object:

```ts
    compareAMs, setCompareA, compareBMs, setCompareB, compareView, setCompareView,
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/hooks/useChartClock.ts
git commit -m "feat(mobile): useChartClock compare state (A=birth, B=now, view)"
```

---

### Task 5: `CompareWheel` — one self-contained chart

**Files:**
- Create: `apps/mobile/components/chart/CompareWheel.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg from "react-native-svg";
import { NIGHT } from "@astro/engine";
import type { Positions } from "@astro/engine";
import { Dial } from "./Dial";
import { AspectLayer } from "./AspectLayer";
import { LiveLayer } from "./LiveLayer";

interface Props {
  /** Unique per wheel ("a-" / "b-") so two Dials' <Defs> ids never collide on web. */
  idPrefix: string;
  /** "Chart A" / "Chart B". */
  caption: string;
  /** Formatted date · time · tz for this wheel's moment. */
  subCaption: string;
  /** Square edge length in px. */
  size: number;
  /** Planets at this wheel's moment. */
  pos: Positions;
  showMajor: boolean;
  showMinor: boolean;
}

/** One Compare chart for a single instant: the zodiac Dial, this moment's planets (live
 *  ring) and that moment's own aspects. No fixed natal overlay — mirrors the web CompareWheel. */
function CompareWheelBase({ idPrefix, caption, subCaption, size, pos, showMajor, showMinor }: Props) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cap}>{caption}</Text>
      <Text style={styles.sub}>{subCaption}</Text>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 1000 1000">
          <Dial idPrefix={idPrefix} />
          <AspectLayer positions={pos} showMajor={showMajor} showMinor={showMinor} />
          <LiveLayer positions={pos} />
        </Svg>
      </View>
    </View>
  );
}

export const CompareWheel = memo(CompareWheelBase);

const styles = StyleSheet.create({
  cell: { alignItems: "center" },
  cap: { color: NIGHT.text, fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  sub: { color: NIGHT.textDim, fontSize: 12, marginTop: 2, marginBottom: 6, fontVariant: ["tabular-nums"] },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/chart/CompareWheel.tsx
git commit -m "feat(mobile): CompareWheel — one chart for a single instant"
```

---

### Task 6: `CompareView` — Both (stacked) + Pages (pager)

**Files:**
- Create: `apps/mobile/components/chart/CompareView.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { memo, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { NIGHT } from "@astro/engine";
import type { Positions } from "@astro/engine";
import { CHART } from "./palette";
import { CompareWheel } from "./CompareWheel";
import { pageIndex } from "../../lib/chartModel";
import { SHEET_COLLAPSED_HEIGHT } from "../BottomSheet";

interface WheelData {
  caption: string;
  sub: string;
  pos: Positions;
}

interface Props {
  a: WheelData;
  b: WheelData;
  view: "both" | "pages";
  showMajor: boolean;
  showMinor: boolean;
}

// Vertical chrome above/below the two wheels in "Both" (header + collapsed sheet + each
// wheel's caption/sub + gaps). A tuned constant — refine on-device like the 3a sheet height.
const COMPARE_CHROME = 360;

function CompareViewBase({ a, b, view, showMajor, showMinor }: Props) {
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);

  if (view === "pages") {
    const full = Math.max(0, Math.min(width, height) - CHART.wheelPadding);
    const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
      setPage(pageIndex(e.nativeEvent.contentOffset.x, width, 2));
    return (
      <View style={styles.fill}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onEnd}
        >
          {[a, b].map((w, i) => (
            <View key={i} style={[styles.page, { width }]}>
              <CompareWheel
                idPrefix={i === 0 ? "a-" : "b-"}
                caption={w.caption}
                subCaption={w.sub}
                size={full}
                pos={w.pos}
                showMajor={showMajor}
                showMinor={showMinor}
              />
            </View>
          ))}
        </ScrollView>
        <View style={styles.dots}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
      </View>
    );
  }

  // Both: two wheels stacked, each sized to fit half the available height.
  const each = Math.max(
    0,
    Math.min(width - CHART.wheelPadding, Math.floor((height - COMPARE_CHROME) / 2)),
  );
  return (
    <View style={styles.stack}>
      <CompareWheel idPrefix="a-" caption={a.caption} subCaption={a.sub} size={each} pos={a.pos} showMajor={showMajor} showMinor={showMinor} />
      <CompareWheel idPrefix="b-" caption={b.caption} subCaption={b.sub} size={each} pos={b.pos} showMajor={showMajor} showMinor={showMinor} />
    </View>
  );
}

export const CompareView = memo(CompareViewBase);

const styles = StyleSheet.create({
  fill: { flex: 1, alignSelf: "stretch" },
  page: { alignItems: "center", justifyContent: "center", paddingBottom: SHEET_COLLAPSED_HEIGHT },
  stack: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: SHEET_COLLAPSED_HEIGHT },
  dots: { position: "absolute", bottom: SHEET_COLLAPSED_HEIGHT + 14, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NIGHT.border },
  dotOn: { backgroundColor: NIGHT.live, width: 9, height: 9, borderRadius: 4.5 },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/chart/CompareView.tsx
git commit -m "feat(mobile): CompareView — stacked Both + swipe Pages with dots"
```

---

### Task 7: Controls — `Segmented` wrap + Compare section

**Files:**
- Modify: `apps/mobile/components/Segmented.tsx`
- Modify: `apps/mobile/components/chart/ChartControls.tsx`

- [ ] **Step 1: Add an optional `wrap` prop to `Segmented`**

In `apps/mobile/components/Segmented.tsx`, extend `Props` and the component:

```tsx
interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  wrap?: boolean;
}

export function Segmented<T extends string>({ options, value, onChange, wrap = false }: Props<T>) {
  return (
    <View style={[styles.row, wrap && styles.rowWrap]}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.seg, wrap && styles.segWrap, on && styles.segOn]}>
            <Text style={[styles.txt, on && styles.txtOn]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

Add to the `StyleSheet.create({ ... })`:

```tsx
  rowWrap: { flexWrap: "wrap" },
  segWrap: { flexBasis: "31%", flexGrow: 1 },
```

- [ ] **Step 2: Add Compare to the mode switcher + the Compare section**

In `apps/mobile/components/chart/ChartControls.tsx`:

Change the type import to include `CompareView`:

```ts
import type { Mode, TimeFormat, CompareView } from "../../lib/chartModel";
```

Add `compare` to the `MODES` array:

```ts
const MODES: { key: Mode; label: string }[] = [
  { key: "birth", label: "Birth" },
  { key: "now", label: "Now" },
  { key: "moment", label: "Date" },
  { key: "range", label: "Range" },
  { key: "compare", label: "Compare" },
];
```

Add a Compare-view options constant next to `FORMATS`:

```ts
const CVIEWS: { key: CompareView; label: string }[] = [
  { key: "both", label: "Both" },
  { key: "pages", label: "Pages" },
];
```

Destructure the new clock members (extend the existing `const { ... } = clock;`):

```ts
  const {
    mode, setMode, momentMs, setMomentMs,
    rangeStartMs, setRangeStartMs, rangeEndMs, setRangeEndMs,
    playing, togglePlay, loop, toggleLoop, rate, setRate, resetPlay,
    compareAMs, setCompareA, compareBMs, setCompareB, compareView, setCompareView,
  } = clock;
```

Make the mode `Segmented` wrap (the `<Section label="View">` block):

```tsx
      <Section label="View">
        <Segmented options={MODES} value={mode} onChange={setMode} wrap />
      </Section>
```

Add the Compare section immediately after the `mode === "range" ? (...) : null` block:

```tsx
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
```

Add a `note` style to the `StyleSheet.create({ ... })`:

```tsx
  note: { color: NIGHT.textDim, fontSize: 12, marginTop: 10, lineHeight: 17 },
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/Segmented.tsx apps/mobile/components/chart/ChartControls.tsx
git commit -m "feat(mobile): Compare in the mode switcher + Compare controls section"
```

---

### Task 8: Screen wiring — `App.tsx`

**Files:**
- Modify: `apps/mobile/App.tsx`

- [ ] **Step 1: Imports + MODE_LABEL**

Add `cmpCaption` to the readout import and import `CompareView`:

```ts
import { fmtDate, fmtTime, readoutTz, cmpCaption } from "./lib/readout";
import { CompareView } from "./components/chart/CompareView";
```

Extend `MODE_LABEL` (a `Record<Mode, string>`, so the `compare` key is now required):

```ts
const MODE_LABEL: Record<Mode, string> = { birth: "Birth", now: "Now", moment: "Date", range: "Range", compare: "Compare" };
```

- [ ] **Step 2: Compare positions + captions**

After `const livePos = useMemo(() => positions(clock.displayInstant), [clock.displayInstant]);`:

```ts
  const compareAPos = useMemo(() => positions(new Date(clock.compareAMs)), [clock.compareAMs]);
  const compareBPos = useMemo(() => positions(new Date(clock.compareBMs)), [clock.compareBMs]);
  const cmpA = cmpCaption(clock.compareAMs, birth, timeFormat);
  const cmpB = cmpCaption(clock.compareBMs, birth, timeFormat);
```

- [ ] **Step 3: Branch the stage on Compare**

Replace the existing `<View style={styles.stage}> … </View>` block with:

```tsx
      {clock.mode === "compare" ? (
        fontsLoaded ? (
          <CompareView
            a={{ caption: "Chart A", sub: cmpA, pos: compareAPos }}
            b={{ caption: "Chart B", sub: cmpB, pos: compareBPos }}
            view={clock.compareView}
            showMajor={showMajor}
            showMinor={showMinor}
          />
        ) : (
          <View style={styles.stage}><Text style={styles.note}>loading…</Text></View>
        )
      ) : (
        <View style={styles.stage}>
          <Text style={styles.moment}>{moment}</Text>
          <Text style={styles.bigThree}>{bigThree}</Text>
          <View style={[styles.wheelBox, { width: wheelSize, height: wheelSize }]}>
            {fontsLoaded
              ? <ChartWheel natalPositions={natalPos} livePositions={livePos} showMajor={showMajor} showMinor={showMinor} />
              : <Text style={styles.note}>loading…</Text>}
          </View>
        </View>
      )}
```

(The `RangeHud` line and `BottomSheet` below are unchanged. In Compare the global readout
pill and the big-three line are intentionally not rendered — each wheel carries its own
caption and the two wheels need the vertical room.)

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): render CompareView in Compare mode (hide pill + big-three)"
```

---

### Task 9: Verify the slice

**Files:** none (verification only).

- [ ] **Step 1: Typecheck + tests**

```bash
pnpm --filter @astro/mobile typecheck
pnpm --filter @astro/mobile test
pnpm --filter @astro/engine test
```
Expected: typecheck exit 0; mobile tests green (prior + 7 new `pageIndex`); engine tests
still green (unchanged).

- [ ] **Step 2: Bundle**

```bash
cd apps/mobile && npx expo export --platform android
```
Expected: bundles with no resolver errors (no new native modules).

- [ ] **Step 3: Web smoke via `/browse`**

Start the web target (`cd apps/mobile && npx expo start --web --port 8082`) and, with the
gstack `/browse` skill (viewport 390×844):
- Open the sheet → tap **Compare**. Confirm two **stacked** wheels, each with a
  `Chart A · …` / `Chart B · …` caption; Chart A shows the birth chart, Chart B "now".
- Toggle **Pages** → a horizontal pager; swipe A↔B; the page **dots** update.
- Edit **Chart A** and **Chart B** dates → the corresponding wheel's glyphs move.
- Toggle **Major/Minor** and **12h/24h** → both wheels respond.

(`cmpCaption` correctness is confirmed here — it is not unit-tested because `readout.ts`
imports engine runtime.)

- [ ] **Step 4: Hand off for on-device confirmation**

Report status and ask the user to verify on-device (Expo Go): the page-turn feel (swipe +
dots), stacked readability, per-wheel captions, each wheel's own aspects, and Major/Minor +
12h/24h affecting both. Tune `COMPARE_CHROME` (Task 6) if the stacked wheels sit too
large/small.

---

## Completion

After all tasks verify and the user confirms on-device:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch — verify tests,
  present options, and (per the user's standing intent) open/merge the PR for Slice 3b.
