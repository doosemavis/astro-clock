# Slice 3c-i — Mobile Theme (Light / Dark / Auto) Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm); spec under review
**Author:** moosedavis + Claude

---

## 1. Concept

Give the mobile app a **Light / Dark / Auto** theme, matching the web. Every surface — the
chart wheel (glyphs, rings, sign labels, aspect lines), the background, and all chrome
(bottom sheet, controls, pills, birth form) — blends between the engine's `NIGHT` and `DAY`
palettes. **Auto** sets the blend from the real Sun altitude at the displayed moment and the
birth location; **Light** and **Dark** pin it.

This is **sub-slice 3c-i**, the first of three that complete "full web parity" on mobile:

- **3c-i (this spec):** the Light/Dark/Auto theme — the color foundation.
- **3c-ii:** per-planet glyph **visibility grid**.
- **3c-iii:** the sun-altitude **day/night sky** (starfield + clouds) behind the wheel.

The theme is foundational: 3c-ii and 3c-iii build on the runtime palette this slice lays.

## 2. Goals

- A `ThemeMode = "light" | "dark" | "auto"`, default **`"dark"`** (today's look), chosen from
  a **Theme** segmented control in the bottom sheet.
- A single `themeT` ∈ [0,1] (0 = night, 1 = day): `light → 1`, `dark → 0`,
  `auto → solarT(displayInstant, birth.lat, birth.lon)`. In **Compare**, the moment is
  `compareAMs` (web parity).
- The **whole app** re-colors from a runtime-blended palette — wheel layers *and* chrome.
- **No engine astronomy changes**; one small pure addition (`mixPalette`). Reuse `solarT`,
  `aspectColor`, `mixColor`, `NIGHT`, `DAY`, `Palette` (all already exported).

## 3. Non-goals (deferred)

- **Day/night sky** (starfield + clouds) — **3c-iii**. This slice changes *colors* only; no
  sky backdrop yet (Light/Auto show a lighter palette on a flat background).
- **Per-planet visibility grid** — **3c-ii**.
- **Device-location daylight** for Now — Auto uses the **birth** location (web parity); no
  GPS permission.

## 4. Approach — resolve colors at runtime, blend `NIGHT`↔`DAY`

RN `StyleSheet` colors are fixed at definition time, so theming means resolving colors at
render from a current `Palette`, provided via context.

### 4.1 Engine — `mixPalette` (`packages/engine/src/theme.ts`, + index export, + test)

Add a pure helper next to `mixColor` / `themeVars` that returns a whole blended `Palette`:

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

Export it from `packages/engine/src/index.ts` alongside `mixColor` / `themeVars`.

### 4.2 Theme context — `apps/mobile/lib/theme.tsx` (new)

```tsx
const Ctx = createContext<{ t: number; palette: Palette }>({ t: 0, palette: NIGHT });
export const ThemeProvider = Ctx.Provider;
export const useTheme = () => useContext(Ctx);
```

`useTheme()` yields both the blended `palette` (for `fill`/`stroke`/style colors) and the
raw `t` (for `aspectColor(def, t)`).

### 4.3 `themeT` + provider — `App.tsx`

- `const [themeMode, setThemeMode] = useState<ThemeMode>("dark");`
- ```ts
  const themeT = useMemo(() => {
    if (themeMode === "light") return 1;
    if (themeMode === "dark") return 0;
    const inst = clock.mode === "compare" ? new Date(clock.compareAMs) : clock.displayInstant;
    return quantize(solarT(inst, birth.lat, birth.lon)); // quantize = round to 0.02 steps
  }, [themeMode, clock.mode, clock.displayInstant, clock.compareAMs, birth.lat, birth.lon]);
  const palette = useMemo(() => mixPalette(themeT), [themeT]);
  ```
- Wrap the whole tree in `<ThemeProvider value={{ t: themeT, palette }}>`.
- **Quantize** `themeT` (round to ~0.02) so Auto+Range re-blends ~50× across a day, not every
  frame — bounds re-renders/style recreation.

### 4.4 Chrome — `makeStyles(palette)` (App, BottomSheet, Segmented, RangeHud, ChartControls, BirthForm, OffsetSelect, CompareView, CompareWheel)

Convert each module's static `StyleSheet.create({…NIGHT…})` to a factory keyed on the
palette, resolved per render:

```tsx
const p = useTheme().palette;
const styles = useMemo(() => makeStyles(p), [p]);
// ...
const makeStyles = (p: Palette) => StyleSheet.create({
  section: { borderColor: p.border, /* layout props unchanged */ },
  // every NIGHT.x -> p.x
});
```

Inline color props that referenced `NIGHT.*` directly (e.g. `DateTimePicker textColor`) read
`p.*` instead.

### 4.5 SVG layers — `useTheme` (Dial, NatalLayer, LiveLayer, AspectLayer; pass-through in ChartWheel/CompareWheel)

The layers currently import `C = NIGHT` from `palette.ts`. They instead read
`const { palette: p, t } = useTheme()` and use `p.line` / `p.sign` / `p.natal` / `p.live` /
`p.bg`. `AspectLayer` swaps `aspectColor(def, 0)` → `aspectColor(def, t)`. `palette.ts` keeps
only the layout constants `CHART` and `GLYPH_FONT` (its `C`/`NIGHT` import is removed).

### 4.6 Theme control — `ChartControls.tsx`

Add `ThemeMode` to `chartModel.ts`. Add a **Theme** `Section` with a `Segmented`
`Light | Dark | Auto` bound to `themeMode` / `setThemeMode` (threaded from `App` as props,
like `timeFormat` / `onTimeFormat`).

## 5. Files

| File | Action | Notes |
|---|---|---|
| `packages/engine/src/theme.ts` (+ `theme.test.ts`) | edit | add `mixPalette(t)` + unit test |
| `packages/engine/src/index.ts` | edit | export `mixPalette` |
| `apps/mobile/lib/theme.tsx` | new | `ThemeProvider` + `useTheme` (`{ t, palette }`) |
| `apps/mobile/lib/chartModel.ts` | edit | add `ThemeMode` type |
| `apps/mobile/components/chart/palette.ts` | edit | drop `C`/`NIGHT`; keep `CHART` + `GLYPH_FONT` |
| `apps/mobile/components/chart/{Dial,NatalLayer,LiveLayer,AspectLayer}.tsx` | edit | `useTheme()`; `aspectColor(def, t)` |
| `apps/mobile/components/chart/{ChartWheel,CompareWheel,CompareView}.tsx` | edit | palette colors via `useTheme` |
| `apps/mobile/components/{Segmented,BottomSheet,OffsetSelect,BirthForm}.tsx` | edit | `makeStyles(palette)` |
| `apps/mobile/components/chart/{ChartControls,RangeHud}.tsx` | edit | `makeStyles(palette)`; ChartControls adds Theme control |
| `apps/mobile/App.tsx` | edit | `themeMode` state, `themeT`, `palette`, `ThemeProvider`, pass theme props to controls |

## 6. Verification

**Here (no device):**
1. **Engine unit test** (`node --test`): `mixPalette(0).bg === mixColor(NIGHT.bg, DAY.bg, 0)`,
   `mixPalette(1).live === mixColor(NIGHT.live, DAY.live, 1)`, all 11 keys present, clamps.
2. `pnpm --filter @astro/mobile typecheck` clean; mobile + engine test suites green.
3. `npx expo export --platform android` bundles.
4. Web `/browse` (390×844): toggle **Light / Dark / Auto** in Birth / Now / Range / Compare;
   confirm the whole app (wheel + sheet + pills + background) blends, Dark matches today,
   Auto tracks the moment (e.g. Range across a day shifts the palette).

**On device:** the three themes look right; Auto's day/night shift reads well; controls stay
legible in Light (the gold accent becomes DAY's dark `live` — confirm it's acceptable).

## 7. Risks + fallbacks

- **Breadth (12 files).** Mechanical `makeStyles(palette)` pattern, done file-by-file with
  per-file commits; typecheck after each. Fallback: none needed — additive.
- **Per-frame cost in Auto+Range.** Quantizing `themeT` bounds palette changes (~50/day).
  Fallback: coarsen the step if a low-end device janks.
- **Gold accent → navy in Light/day.** Expected under full-app parity. Fallback: if it reads
  poorly, pin control accents to the `NIGHT.live` gold regardless of theme (one-line, deferred
  to device feedback).
- **`useTheme` in memoized layers.** Context change re-renders them (intended for theme); when
  the palette is stable (Light/Dark), they don't re-render. No correctness risk.

## 8. Out of scope (later sub-slices)

Day/night sky — starfield + clouds (**3c-iii**). Per-planet visibility grid (**3c-ii**).
Device-location daylight. Persisting the chosen theme across launches (small follow-up;
the birth-zone persistence note also still stands). Synastry (→ Pro). Auth / cloud sync.
