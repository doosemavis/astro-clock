# Mobile Visibility Grid + Avatar + Time-Format (Slice 3c-ii) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** (1) per-planet Fixed/Moving visibility grid; (2) a header avatar circle defaulting to the user's Sun-sign glyph; (3) make the 12h/24h toggle reformat the settings-panel time inputs; (4) give the birth form its own 12h/24h toggle.

**Architecture:** A `Vis = { natal, live }` model with pure `toggleVis`/`allVisible` (engine-free, TDD). Layers gain **optional** `vis?` filter props (undefined = show all), so every commit stays green until `App` wires state in the keystone. Engine gains a static `SIGN_GLYPH` map. New `VisGrid` and `Avatar` components are themed via `useTheme` (3c-i). `DateField` takes `timeFormat`; `BirthForm` gets its own toggle.

**Tech Stack:** Expo SDK 54 / RN 0.81 / React 19, `react-native-svg`, `@astro/engine`. No new deps.

**Reference spec:** `docs/specs/2026-06-02-mobile-vis-grid-3c-ii-design.md` (incl. §9 avatar, §10 time-format).

---

### Task 1: `chartModel` — `Vis` types + `allVisible` + `toggleVis` (TDD)

**Files:** Modify `apps/mobile/lib/chartModel.ts`; Test `apps/mobile/lib/chartModel.test.ts`.

- [ ] **Step 1: Failing tests** — append to `chartModel.test.ts` (add `allVisible, toggleVis` to the `./chartModel.ts` import; add `import type { PlanetKey } from "@astro/engine";` — type-only, erased by the strip-types runner):

```ts
const KEYS: PlanetKey[] = ["sun", "moon", "mercury"];

test("allVisible: every key true", () => {
  assert.deepEqual(allVisible(KEYS), { sun: true, moon: true, mercury: true });
});
test("toggleVis: flips one planet on one layer only, immutably", () => {
  const vis = { natal: allVisible(KEYS), live: allVisible(KEYS) };
  const next = toggleVis(vis, "moon", "live");
  assert.equal(next.live.moon, false);
  assert.equal(next.live.sun, true);      // other live keys untouched
  assert.equal(next.natal.moon, true);    // other layer untouched
  assert.equal(vis.live.moon, true);      // original not mutated
});
test("toggleVis all: when every key is on, turns the layer off", () => {
  const vis = { natal: allVisible(KEYS), live: allVisible(KEYS) };
  const next = toggleVis(vis, "all", "natal");
  assert.deepEqual(next.natal, { sun: false, moon: false, mercury: false });
  assert.deepEqual(next.live, vis.live);   // other layer untouched
});
test("toggleVis all: when some are off, turns the whole layer on", () => {
  const vis = { natal: { sun: true, moon: false, mercury: true } as Record<PlanetKey, boolean>, live: allVisible(KEYS) };
  const next = toggleVis(vis, "all", "natal");
  assert.deepEqual(next.natal, { sun: true, moon: true, mercury: true });
});
```

- [ ] **Step 2: Run — fails** (`pnpm --filter @astro/mobile test`).

- [ ] **Step 3: Implement** — in `chartModel.ts`, add `import type { PlanetKey } from "@astro/engine";` at the top (next to the `BirthData` type import), then:

```ts
export type Layer = "natal" | "live";
export type VisMap = Record<PlanetKey, boolean>;
export interface Vis { natal: VisMap; live: VisMap; }

/** A visibility map with every given planet shown. */
export function allVisible(keys: PlanetKey[]): VisMap {
  const m = {} as VisMap;
  keys.forEach((k) => { m[k] = true; });
  return m;
}

/** Immutable per-planet/per-layer toggle. `key === "all"` flips the whole layer to the
 *  opposite of "is every key currently on". Never mutates the input. */
export function toggleVis(vis: Vis, key: PlanetKey | "all", layer: Layer): Vis {
  const map = vis[layer];
  if (key === "all") {
    const allOn = Object.values(map).every(Boolean);
    const next = {} as VisMap;
    (Object.keys(map) as PlanetKey[]).forEach((k) => { next[k] = !allOn; });
    return { ...vis, [layer]: next };
  }
  return { ...vis, [layer]: { ...map, [key]: !map[key] } };
}
```

- [ ] **Step 4: Run — passes.**
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/chartModel.ts apps/mobile/lib/chartModel.test.ts
git commit -m "feat(mobile): Vis model + toggleVis/allVisible (TDD)"
```

---

### Task 2: Engine — `SIGN_GLYPH`

**Files:** Modify `packages/engine/src/types.ts` (and `index.ts` only if needed).

- [ ] **Step 1:** In `types.ts`, after `export type Sign = ...`, add:

```ts
/** Zodiac symbols, keyed to SIGNS (used for the user's sign avatar). */
export const SIGN_GLYPH: Record<Sign, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍",
  Libra: "♎", Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓",
};
```

`index.ts` does `export * from "./types.ts"`, so `SIGN_GLYPH` is automatically public — no `index.ts` edit needed.

- [ ] **Step 2:** `pnpm --filter @astro/engine test` still green (static map, no test).
- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/types.ts
git commit -m "feat(engine): SIGN_GLYPH zodiac symbol map"
```

---

### Task 3: Layer visibility filters (optional → green)

**Files:** Modify `NatalLayer.tsx`, `LiveLayer.tsx`, `AspectLayer.tsx`.

- [ ] **Step 1: `NatalLayer`** — add `import type { VisMap } from "../../lib/chartModel";`; `Props` gets `vis?: VisMap;`. In the `PLANET_KEYS.map((key) => ...)`, first line: `if (vis && !vis[key]) return null;`.
- [ ] **Step 2: `LiveLayer`** — same: `vis?: VisMap`; `if (vis && !vis[key]) return null;`.
- [ ] **Step 3: `AspectLayer`** — `Props` gets `visLive?: VisMap;`. Filter the pairs:
  `findAspects(positions, { major: showMajor, minor: showMinor }).filter(({ a, b }) => !visLive || (visLive[a] && visLive[b])).map(...)`.
- [ ] **Step 4: Typecheck** — exit 0 (no caller passes `vis` yet → unchanged render).
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/chart/NatalLayer.tsx apps/mobile/components/chart/LiveLayer.tsx apps/mobile/components/chart/AspectLayer.tsx
git commit -m "feat(mobile): optional per-planet visibility filters in chart layers"
```

---

### Task 4: Thread `vis` through the wheels

**Files:** Modify `ChartWheel.tsx`, `CompareWheel.tsx`, `CompareView.tsx`.

- [ ] **Step 1: `ChartWheel`** — `import type { Vis } from "../../lib/chartModel";`; `Props` gets `vis?: Vis;`. Pass `vis={vis?.natal}` to `NatalLayer`, `vis={vis?.live}` to `LiveLayer`, `visLive={vis?.live}` to `AspectLayer`.
- [ ] **Step 2: `CompareWheel`** — `import type { VisMap }`; `Props` gets `vis?: VisMap;`. Pass `vis={vis}` to its `LiveLayer`, `visLive={vis}` to its `AspectLayer`.
- [ ] **Step 3: `CompareView`** — `Props` gets `vis?: VisMap;`; forward `vis={vis}` to both `CompareWheel`s.
- [ ] **Step 4: Typecheck** — exit 0 (callers still don't pass `vis`).
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/chart/ChartWheel.tsx apps/mobile/components/chart/CompareWheel.tsx apps/mobile/components/chart/CompareView.tsx
git commit -m "feat(mobile): thread optional vis through ChartWheel + Compare"
```

---

### Task 5: `VisGrid` component (new)

**Files:** Create `apps/mobile/components/chart/VisGrid.tsx`.

- [ ] **Step 1: Write the component**

```tsx
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PLANET_KEYS, PLANET_GLYPH } from "@astro/engine";
import type { Palette, PlanetKey } from "@astro/engine";
import { GLYPH_FONT } from "./palette";
import { useTheme } from "../../lib/theme";
import type { Vis, Layer } from "../../lib/chartModel";

interface Props {
  vis: Vis;
  onToggle: (key: PlanetKey | "all", layer: Layer) => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Check({ on, onPress }: { on: boolean; onPress: () => void }) {
  const { palette: p } = useTheme();
  const s = checkStyle(p);
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[s.box, on && { backgroundColor: p.live, borderColor: p.live }]}>
      {on ? <Text style={s.tick}>✓</Text> : null}
    </Pressable>
  );
}
const checkStyle = (p: Palette) => StyleSheet.create({
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: p.border, alignItems: "center", justifyContent: "center" },
  tick: { color: p.bg, fontSize: 14, fontWeight: "800" },
});

function VisGridBase({ vis, onToggle }: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const allNatal = PLANET_KEYS.every((k) => vis.natal[k]);
  const allLive = PLANET_KEYS.every((k) => vis.live[k]);
  return (
    <View>
      <View style={s.row}>
        <Text style={[s.name, s.headLabel]}>Glyph</Text>
        <Text style={s.colHead}>Fixed</Text>
        <Text style={s.colHead}>Moving</Text>
      </View>
      <View style={s.row}>
        <Text style={[s.name, s.allLabel]}>All</Text>
        <View style={s.col}><Check on={allNatal} onPress={() => onToggle("all", "natal")} /></View>
        <View style={s.col}><Check on={allLive} onPress={() => onToggle("all", "live")} /></View>
      </View>
      {PLANET_KEYS.map((key) => (
        <View key={key} style={s.row}>
          <Text style={s.name}><Text style={s.glyph}>{PLANET_GLYPH[key]}</Text>  {cap(key)}</Text>
          <View style={s.col}><Check on={vis.natal[key]} onPress={() => onToggle(key, "natal")} /></View>
          <View style={s.col}><Check on={vis.live[key]} onPress={() => onToggle(key, "live")} /></View>
        </View>
      ))}
    </View>
  );
}

export const VisGrid = memo(VisGridBase);

const makeStyles = (p: Palette) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 5 },
  name: { flex: 1, color: p.text, fontSize: 14 },
  glyph: { fontFamily: GLYPH_FONT, color: p.live, fontSize: 16 },
  col: { width: 64, alignItems: "center" },
  colHead: { width: 64, textAlign: "center", color: p.seclabel, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  headLabel: { color: p.seclabel, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  allLabel: { fontWeight: "700" },
});
```

- [ ] **Step 2: Typecheck** — exit 0.
- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/chart/VisGrid.tsx
git commit -m "feat(mobile): VisGrid — per-planet Fixed/Moving checkbox grid"
```

---

### Task 6: `Avatar` component (new)

**Files:** Create `apps/mobile/components/Avatar.tsx`.

- [ ] **Step 1: Write the component**

```tsx
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Palette } from "@astro/engine";
import { GLYPH_FONT } from "./chart/palette";
import { useTheme } from "../lib/theme";

interface Props {
  /** Glyph shown as the default avatar image (the user's sign). */
  glyph: string;
  size?: number;
}

/** A circular avatar. Default content is the user's sign glyph; a future `imageUri` could
 *  render an <Image> instead. Themed via useTheme. */
function AvatarBase({ glyph, size = 42 }: Props) {
  const { palette: p } = useTheme();
  const s = styles(p);
  return (
    <View style={[s.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.glyph, { fontSize: size * 0.5 }]}>{glyph}</Text>
    </View>
  );
}

export const Avatar = memo(AvatarBase);

const styles = (p: Palette) => StyleSheet.create({
  circle: { borderWidth: 1.5, borderColor: p.live, backgroundColor: p.panel, alignItems: "center", justifyContent: "center" },
  glyph: { fontFamily: GLYPH_FONT, color: p.live },
});
```

- [ ] **Step 2: Typecheck** — exit 0.
- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/Avatar.tsx
git commit -m "feat(mobile): Avatar circle component (default = sign glyph)"
```

---

### Task 7: Time-format — `DateField` respects `timeFormat`; `BirthForm` own toggle

**Files:** Modify `ChartControls.tsx`, `BirthForm.tsx`.

- [ ] **Step 1: `DateField` takes `timeFormat`** — in `ChartControls.tsx`, add `timeFormat: TimeFormat` to `DateField`'s prop type, and replace its `timeStr`:

```tsx
const opts: Intl.DateTimeFormatOptions =
  timeFormat === "24h"
    ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
    : { hour: "2-digit", minute: "2-digit", hour12: true };
const timeStr = padHour(d.toLocaleTimeString(undefined, opts));
```

Pass `timeFormat={timeFormat}` to every `<DateField ... />` in `ChartControls` (Moment, From, To, Chart A, Chart B). (`timeFormat` is already a prop of `ChartControls`.)

- [ ] **Step 2: `BirthForm` own toggle** — in `BirthForm.tsx`:
  - Import `Segmented` (`import { Segmented } from "./Segmented";`) and `type { TimeFormat }` from `../lib/chartModel`.
  - Add optional prop `timeFormat?: TimeFormat;` to `Props`; seed local state `const [birthTf, setBirthTf] = useState<TimeFormat>(initial timeFormat ?? "12h");` and re-seed it in the existing modal-open reset effect.
  - Add a formatter + a Clock toggle, and use the formatter for the birth-time field display:
    ```tsx
    const FORMATS: { key: TimeFormat; label: string }[] = [{ key: "12h", label: "12h" }, { key: "24h", label: "24h" }];
    const showTimeStr = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      const d = new Date(2000, 0, 1, h || 0, m || 0);
      const opts: Intl.DateTimeFormatOptions = birthTf === "24h"
        ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
        : { hour: "2-digit", minute: "2-digit", hour12: true };
      return d.toLocaleTimeString(undefined, opts).replace(/^(\d):/, "0$1:");
    };
    ```
  - Change the time field display `<Text style={styles.inputText}>{time}</Text>` → `{showTimeStr(time)}`.
  - Under the Birth time field, add a `Text style={styles.label}` "Clock" + `<Segmented options={FORMATS} value={birthTf} onChange={setBirthTf} />`.
  - (Stored `time` stays canonical `HH:MM` from the picker — unchanged.)

- [ ] **Step 3: Typecheck** — exit 0.
- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/chart/ChartControls.tsx apps/mobile/components/BirthForm.tsx
git commit -m "feat(mobile): 12h/24h applies to panel time inputs + birth-form has its own toggle"
```

---

### Task 8: Keystone — `App` wiring + `ChartControls` Glyphs section + header avatar

**Files:** Modify `App.tsx`, `ChartControls.tsx`.

- [ ] **Step 1: `ChartControls` — Glyphs section + props**

Add to `Props`: `vis: Vis; onToggleVis: (key: PlanetKey | "all", layer: Layer) => void;`. Import `VisGrid`, `type { Vis, Layer }` from chartModel + `type { PlanetKey }` from engine. Destructure `vis, onToggleVis`. After the **Aspects** `Section`, add:

```tsx
      <Section label="Glyphs">
        <VisGrid vis={vis} onToggle={onToggleVis} />
      </Section>
```

- [ ] **Step 2: `App` — imports + vis state**

```ts
import { /* … */ PLANET_KEYS, SIGN_GLYPH } from "@astro/engine";
import type { BirthData, Palette, Sign, PlanetKey } from "@astro/engine";
import { allVisible, toggleVis } from "./lib/chartModel";
import type { /* … */ Vis, Layer } from "./lib/chartModel";
import { Avatar } from "./components/Avatar";
```
```ts
const [vis, setVis] = useState<Vis>(() => ({ natal: allVisible(PLANET_KEYS), live: allVisible(PLANET_KEYS) }));
const onToggleVis = (key: PlanetKey | "all", layer: Layer) => setVis((v) => toggleVis(v, key, layer));
const sunGlyph = SIGN_GLYPH[signOf(natalPos.sun) as Sign];
```

- [ ] **Step 3: `App` — header avatar**

Replace the header right-side `Pressable`/text:
```tsx
          <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
            <Text style={styles.editText}>{displayName}  ✎</Text>
          </Pressable>
```
with:
```tsx
          <Pressable onPress={() => setEditing(true)} style={styles.editBtn}>
            <Text style={styles.editText}>{displayName}</Text>
            <Avatar glyph={sunGlyph} />
          </Pressable>
```
and make `editBtn` a row in `makeStyles`: `editBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, paddingLeft: 12 }`.

- [ ] **Step 4: `App` — thread vis + birth-form timeFormat**

- `<ChartWheel … vis={vis} />`
- `<CompareView … vis={vis.live} />`
- `<ChartControls … vis={vis} onToggleVis={onToggleVis} />`
- `<BirthForm … timeFormat={timeFormat} />`

- [ ] **Step 5: Typecheck + tests**

```bash
pnpm --filter @astro/mobile typecheck
pnpm --filter @astro/mobile test
```
Expected: exit 0; mobile green.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/App.tsx apps/mobile/components/chart/ChartControls.tsx
git commit -m "feat(mobile): wire vis grid + header avatar + birth-form timeFormat (live)"
```

---

### Task 9: Verify the slice

- [ ] **Step 1:** `pnpm --filter @astro/mobile typecheck`; `pnpm --filter @astro/mobile test`; `pnpm --filter @astro/engine test` — all green.
- [ ] **Step 2:** `cd apps/mobile && npx expo export --platform android` — bundles.
- [ ] **Step 3: Web smoke (`/browse`, 390×844):**
  - Header shows an **avatar circle** with the Sun-sign glyph (♌ for the default chart); tapping opens the birth form.
  - Birth form: a **12h/24h** toggle changes the birth-time display (e.g. `02:28 PM` ↔ `14:28`).
  - **Glyphs** section: uncheck a planet's **Moving** → its inner glyph + aspect lines drop; **Fixed** → its outer glyph drops; **All** clears/restores a ring; Compare honors the moving map.
  - Set **Clock 24h** → the Date/Compare time **inputs** switch to 24h (not just the readout).
- [ ] **Step 4: Hand off for device.**

---

## Completion

After all tasks verify and the user confirms (or per their go-ahead):
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch — verify tests, then merge (PR, mirroring 3a/3b/3c-i).
