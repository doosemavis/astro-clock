# Mobile Theme — Light/Dark/Auto (Slice 3c-i) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A whole-app **Light / Dark / Auto** theme on mobile — every surface blends the engine's `NIGHT`↔`DAY` palettes; Auto follows the Sun at the displayed moment + birth location.

**Architecture:** Engine gains a pure `mixPalette(t)`. A `ThemeProvider` exposes `{ t, palette }`; `App` computes `themeT` (light=1 / dark=0 / auto=`solarT`, quantized) and the blended palette. SVG layers read colors via `useTheme()`; chrome converts its static `StyleSheet` to a memoized `makeStyles(palette)`. A Theme segmented control drives `themeMode`. Until the provider mounts (last task), `useTheme()` returns its default (`NIGHT`), so every intermediate commit renders today's dark look — green and unchanged.

**Tech Stack:** Expo SDK 54 / RN 0.81 / React 19, `react-native-svg`, `@astro/engine`. No new deps.

**Reference spec:** `docs/specs/2026-06-02-mobile-theme-3c-i-design.md`

---

### Task 1: Engine — `mixPalette(t)` (TDD)

**Files:** Modify `packages/engine/src/theme.ts`, `packages/engine/src/index.ts`; Test `packages/engine/src/theme.test.ts` (create if absent).

- [ ] **Step 1: Failing test** — add to `packages/engine/src/theme.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mixPalette, mixColor, NIGHT, DAY } from "./theme.ts";

test("mixPalette(0) equals the NIGHT endpoints (as rgb)", () => {
  assert.equal(mixPalette(0).bg, mixColor(NIGHT.bg, DAY.bg, 0));
  assert.equal(mixPalette(0).live, mixColor(NIGHT.live, DAY.live, 0));
});
test("mixPalette(1) equals the DAY endpoints (as rgb)", () => {
  assert.equal(mixPalette(1).live, mixColor(NIGHT.live, DAY.live, 1));
});
test("mixPalette has all 11 palette keys", () => {
  assert.equal(Object.keys(mixPalette(0.5)).length, 11);
});
test("mixPalette clamps out-of-range t", () => {
  assert.equal(mixPalette(-1).bg, mixPalette(0).bg);
  assert.equal(mixPalette(2).bg, mixPalette(1).bg);
});
```

- [ ] **Step 2: Run — fails** (`pnpm --filter @astro/engine test`) — `mixPalette` not exported.

- [ ] **Step 3: Implement** — append to `packages/engine/src/theme.ts`:

```ts
/** A full palette blended NIGHT->DAY by t (0 = night, 1 = day). The object form of
 *  themeVars(), for runtime styling (React Native has no CSS custom properties). */
export function mixPalette(t: number): Palette {
  t = Math.max(0, Math.min(1, t));
  const out = {} as Palette;
  (Object.keys(THEME_VARS) as (keyof Palette)[]).forEach((k) => {
    out[k] = mixColor(NIGHT[k], DAY[k], t);
  });
  return out;
}
```

In `packages/engine/src/index.ts`, add `mixPalette` to the theme export list (the line with `mixColor, themeVars, aspectColor, solarT`).

- [ ] **Step 4: Run — passes** (`pnpm --filter @astro/engine test`).

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/theme.ts packages/engine/src/theme.test.ts packages/engine/src/index.ts
git commit -m "feat(engine): mixPalette(t) — blended Palette object (TDD)"
```

---

### Task 2: Mobile theme context + `ThemeMode`

**Files:** Create `apps/mobile/lib/theme.tsx`; Modify `apps/mobile/lib/chartModel.ts`.

- [ ] **Step 1: Context** — create `apps/mobile/lib/theme.tsx`:

```tsx
import { createContext, useContext } from "react";
import { NIGHT } from "@astro/engine";
import type { Palette } from "@astro/engine";

export interface Theme { t: number; palette: Palette }

const ThemeContext = createContext<Theme>({ t: 0, palette: NIGHT });

export const ThemeProvider = ThemeContext.Provider;
export const useTheme = (): Theme => useContext(ThemeContext);
```

- [ ] **Step 2: `ThemeMode`** — in `apps/mobile/lib/chartModel.ts`, after `TimeFormat`:

```ts
export type ThemeMode = "light" | "dark" | "auto";
```

- [ ] **Step 3: Typecheck** — `pnpm --filter @astro/mobile typecheck` (exit 0; unused so far).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/lib/theme.tsx apps/mobile/lib/chartModel.ts
git commit -m "feat(mobile): ThemeProvider/useTheme context + ThemeMode type"
```

---

### Task 3: SVG layers read the palette from context

**Files:** Modify `apps/mobile/components/chart/palette.ts`, `Dial.tsx`, `NatalLayer.tsx`, `LiveLayer.tsx`, `AspectLayer.tsx`.

The pattern: drop the `C = NIGHT` import; read `const { palette: p, t } = useTheme();` inside the component; replace `C.x` → `p.x`; `AspectLayer` uses `aspectColor(def, t)`.

- [ ] **Step 1: `palette.ts`** — remove the `NIGHT` import and the `export const C = NIGHT;` line. Keep `CHART` and `GLYPH_FONT`. (If `GLYPH_FONT`/`CHART` don't reference `NIGHT`, the file no longer imports from `@astro/engine`.)

- [ ] **Step 2: `Dial.tsx`** — remove `C` from the palette import; add `import { useTheme } from "../../lib/theme";`. In `DialBase`, add `const { palette: p } = useTheme();`. Replace the 3 `C.line` and the `C.sign` usages (`stroke={C.line}` → `stroke={p.line}`, `fill={C.sign}` → `fill={p.sign}`).

- [ ] **Step 3: `NatalLayer.tsx`** — same: `const { palette: p } = useTheme();`. Replace `C.natal` → `p.natal` (stroke + fill) and `C.bg` → `p.bg` (token fill).

- [ ] **Step 4: `LiveLayer.tsx`** — `const { palette: p } = useTheme();`. Replace `C.live` → `p.live`.

- [ ] **Step 5: `AspectLayer.tsx`** — add `import { useTheme } from "../../lib/theme";`. `const { t } = useTheme();`. Replace `aspectColor(def, 0)` → `aspectColor(def, t)`.

- [ ] **Step 6: Typecheck** — exit 0. (No provider yet → `useTheme()` returns default `NIGHT`; render is byte-identical to today.)

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/chart/palette.ts apps/mobile/components/chart/Dial.tsx apps/mobile/components/chart/NatalLayer.tsx apps/mobile/components/chart/LiveLayer.tsx apps/mobile/components/chart/AspectLayer.tsx
git commit -m "feat(mobile): chart layers read palette from theme context"
```

---

### Task 4: Compare components → `makeStyles(palette)`

**Files:** Modify `apps/mobile/components/chart/CompareWheel.tsx`, `CompareView.tsx`.

The chrome pattern (used here and in Tasks 5-6):

```tsx
import { useMemo } from "react";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme"; // or "../lib/theme" for non-chart components

function Comp(props) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  // ...uses styles as before
}

const makeStyles = (p: Palette) => StyleSheet.create({
  // every former NIGHT.x is now p.x; layout props unchanged
});
```

- [ ] **Step 1: `CompareWheel.tsx`** — replace `import { NIGHT } from "@astro/engine";` with `import type { Palette } from "@astro/engine";` + `import { useTheme } from "../../lib/theme";`. Add the hook + `makeStyles(p)` (tokens: `pill` uses `p.text`, `p.panel`, `p.border`).

- [ ] **Step 2: `CompareView.tsx`** — same conversion. Tokens: `dot` `p.border`, `dotOn` `p.live`, `hint` `p.textDim`.

- [ ] **Step 3: Typecheck** — exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/chart/CompareWheel.tsx apps/mobile/components/chart/CompareView.tsx
git commit -m "feat(mobile): Compare components themed via makeStyles(palette)"
```

---

### Task 5: Chrome → `makeStyles(palette)` (Segmented, BottomSheet, RangeHud)

**Files:** Modify `apps/mobile/components/Segmented.tsx`, `BottomSheet.tsx`, `apps/mobile/components/chart/RangeHud.tsx`.

Apply the same `makeStyles(p)` pattern. Import path is `../lib/theme` for `Segmented`/`BottomSheet`, `../../lib/theme` for `RangeHud`.

- [ ] **Step 1: `Segmented.tsx`** — tokens: `row` (`p.bg`, `p.border`), `segOn` (`p.live`), `txt` (`p.textDim`), `txtOn` (`p.bg`).
- [ ] **Step 2: `BottomSheet.tsx`** — tokens: the sheet card bg/border/handle (3 `NIGHT.*` refs → `p.*`).
- [ ] **Step 3: `RangeHud.tsx`** — tokens: pill bg/border, button/icon colors (5 `NIGHT.*` → `p.*`).
- [ ] **Step 4: Typecheck** — exit 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/Segmented.tsx apps/mobile/components/BottomSheet.tsx apps/mobile/components/chart/RangeHud.tsx
git commit -m "feat(mobile): Segmented/BottomSheet/RangeHud themed via makeStyles(palette)"
```

---

### Task 6: Chrome → `makeStyles(palette)` (ChartControls, BirthForm, OffsetSelect)

**Files:** Modify `apps/mobile/components/chart/ChartControls.tsx`, `apps/mobile/components/BirthForm.tsx`, `apps/mobile/components/OffsetSelect.tsx`.

Same pattern. These are the largest (ChartControls ~20, BirthForm ~22, OffsetSelect ~9 color refs). For `ChartControls`, the inner `DateField` and `Section` are defined in the same module — each is a component, so call `useTheme()` inside them directly. Convert `DateTimePicker textColor={NIGHT.text}` → `p.text`.

- [ ] **Step 1: `ChartControls.tsx`** — convert all `NIGHT.*` style + inline refs to `p.*` via `makeStyles(p)`; `DateField` and any sub-components call `useTheme()` themselves.
- [ ] **Step 2: `BirthForm.tsx`** — convert all `NIGHT.*` to `p.*` via `makeStyles(p)`.
- [ ] **Step 3: `OffsetSelect.tsx`** — convert all `NIGHT.*` to `p.*` via `makeStyles(p)`.
- [ ] **Step 4: Typecheck** — exit 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/chart/ChartControls.tsx apps/mobile/components/BirthForm.tsx apps/mobile/components/OffsetSelect.tsx
git commit -m "feat(mobile): ChartControls/BirthForm/OffsetSelect themed via makeStyles(palette)"
```

---

### Task 7: Keystone — `App` provider + `themeT` + Theme control

**Files:** Modify `apps/mobile/App.tsx`, `apps/mobile/components/chart/ChartControls.tsx`.

This task mounts the provider and the control, activating theming end-to-end.

- [ ] **Step 1: `App.tsx` imports + state**

Add imports:
```ts
import { mixPalette, solarT } from "@astro/engine";
import { ThemeProvider } from "./lib/theme";
import type { ThemeMode } from "./lib/chartModel";
```
Add state (near the other `useState`s):
```ts
const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
```

- [ ] **Step 2: `App.tsx` themeT + palette**

After `clock`/`birth` are available:
```ts
const quantize = (x: number) => Math.round(x * 50) / 50;
const themeT = useMemo(() => {
  if (themeMode === "light") return 1;
  if (themeMode === "dark") return 0;
  const inst = clock.mode === "compare" ? new Date(clock.compareAMs) : clock.displayInstant;
  return quantize(solarT(inst, birth.lat, birth.lon));
}, [themeMode, clock.mode, clock.displayInstant, clock.compareAMs, birth.lat, birth.lon]);
const palette = useMemo(() => mixPalette(themeT), [themeT]);
```

- [ ] **Step 3: `App.tsx` — provider + themed root styles**

Wrap the returned tree in `<ThemeProvider value={{ t: themeT, palette }}> … </ThemeProvider>`. Convert `App`'s own `styles` (root/header/brand/etc., the 7 `NIGHT.*` refs) to `makeStyles(palette)` using the local `palette` (App can't `useTheme()` the provider it renders, so it uses `palette` directly: `const styles = useMemo(() => makeStyles(palette), [palette]);`). Pass theme props to controls:
```tsx
<ChartControls
  clock={clock}
  themeMode={themeMode}
  onTheme={setThemeMode}
  timeFormat={timeFormat}
  /* …existing props… */
/>
```

- [ ] **Step 4: `ChartControls.tsx` — Theme control**

Add to `Props`: `themeMode: ThemeMode; onTheme: (m: ThemeMode) => void;` and import `ThemeMode`. Destructure them. Add a `THEMES` constant and a Theme `Section` (next to Clock):
```tsx
const THEMES: { key: ThemeMode; label: string }[] = [
  { key: "light", label: "Light" }, { key: "dark", label: "Dark" }, { key: "auto", label: "Auto" },
];
// ...in the JSX, after the Clock Section:
<Section label="Theme">
  <Segmented options={THEMES} value={themeMode} onChange={onTheme} />
</Section>
```

- [ ] **Step 5: Typecheck + tests**

```bash
pnpm --filter @astro/mobile typecheck
pnpm --filter @astro/mobile test
```
Expected: exit 0; mobile tests green.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/App.tsx apps/mobile/components/chart/ChartControls.tsx
git commit -m "feat(mobile): mount ThemeProvider + Light/Dark/Auto control (theme live)"
```

---

### Task 8: Verify the slice

- [ ] **Step 1: Typecheck + tests**

```bash
pnpm --filter @astro/mobile typecheck
pnpm --filter @astro/mobile test
pnpm --filter @astro/engine test
```
Expected: typecheck 0; mobile green; engine green (incl. new `mixPalette` tests).

- [ ] **Step 2: Bundle** — `cd apps/mobile && npx expo export --platform android` (no resolver errors).

- [ ] **Step 3: Web smoke (`/browse`, 390×844)** — open the sheet → **Theme** control:
  - **Dark** matches today's look.
  - **Light** turns the whole app (wheel + sheet + pills + background) to the light palette.
  - **Auto** in Range: play across a day and confirm the palette shifts night→day.
  - Switch modes (Birth/Now/Compare) under each theme; confirm no broken colors.

- [ ] **Step 4: Hand off for device** — report status; ask the user to confirm the three themes on-device (legibility, Auto shift, the gold→navy accent in Light). Note `quantize` step / accent-pinning are the tunable knobs.

---

## Completion

After all tasks verify and the user confirms on-device:
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch — verify tests, then merge (PR, mirroring 3a/3b) per the user's go-ahead.
