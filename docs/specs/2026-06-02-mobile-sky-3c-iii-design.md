# Slice 3c-iii — Mobile Day/Night Sky Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm); spec under review
**Author:** moosedavis + Claude

---

## 1. Concept

A sky backdrop behind the chart wheel, cross-faded by the theme value `themeT` (from 3c-i):
- **Night** (`themeT → 0`, or Dark): a **starfield** at full opacity over the dark themed bg.
- **Day** (`themeT → 1`, or Light): the stars fade out and a **soft blue sky gradient** fades in.
- **Auto**: transitions with the sun (`solarT`) — a Range across a day sweeps night→day.

This is the third and final 3c sub-slice, completing full web parity on mobile. Decided in
brainstorm: **stars + gradient** (no `feTurbulence`, reliable on iOS + Android) as a
**full-screen backdrop behind the wheel** (the open wheel center lets faint stars show through).

## 2. Goals

- Port the web `Starfield`'s deterministic stars; add a day gradient; cross-fade by `themeT`.
- Full-screen backdrop behind the header / wheel / sheet; non-interactive (`pointerEvents="none"`).
- No new dependencies (`react-native-svg` provides `LinearGradient`).

## 3. Non-goals

- `feTurbulence` procedural clouds (deliberately skipped — Android support unreliable).
- Masking the sky out of the wheel interior (full backdrop, per brainstorm).
- Per-planet visibility / themes (shipped in 3c-i/ii).

## 4. Approach

### 4.1 `lib/stars.ts` (new, pure, TDD)
- Port `mulberry32(seed)` (deterministic PRNG — no `Math.random`, so SSR/web/device identical).
- `makeStars(count: number, seed: number): Star[]` where `Star = { cx, cy, r, o }`:
  `cx, cy ∈ [0,100)`, `r = 0.04 + rnd()·0.13`, `o = 0.25 + rnd()·0.7` — verbatim from the web.

### 4.2 `components/chart/Sky.tsx` (new)
- Props `{ themeT: number }`.
- An absolutely-positioned, full-screen `<Svg viewBox="0 0 100 100" preserveAspectRatio="none">`
  inside a `View style={StyleSheet.absoluteFill} pointerEvents="none"`:
  - A day-gradient `<Rect>` filling 0–100 with a vertical `LinearGradient` (light sky-blue → deeper
    blue), `opacity={themeT}` — only visible toward day.
  - A `<G opacity={1 − themeT}>` of the 160 `<Circle>` stars (`fill="#ffffff"`, per-star `opacity`),
    memoized via `makeStars(160, 0x5eed)`.
- Memoized; `themeT` changes only swap two opacities, so Auto+Range stays cheap.

### 4.3 `App.tsx`
- Render `<Sky themeT={themeT} />` as the **first** child inside `<ThemeProvider>`, behind the
  header/stage/sheet. (`themeT` already computed in 3c-i.) The root `bg` (themed) remains the base;
  Sky overlays stars at night and the gradient by day.

## 5. Files

| File | Action | Notes |
|---|---|---|
| `lib/stars.ts` (+ test) | new | `mulberry32` + `makeStars` (TDD) |
| `components/chart/Sky.tsx` | new | gradient + starfield backdrop, faded by `themeT` |
| `App.tsx` | edit | render `<Sky themeT={themeT} />` behind the content |

## 6. Verification

1. **Unit test** (`node --test`): `makeStars(160, 0x5eed)` returns 160 stars; deterministic
   (same seed → identical first star); coordinates in `[0,100)`, `r`/`o` in range; a different
   seed yields a different first star.
2. typecheck; mobile + engine suites green.
3. `expo export --platform android` bundles.
4. Web `/browse`: **Dark** shows the starfield; **Light** shows the day gradient (no stars);
   **Auto** during a Range play sweeps night→day; the wheel/controls render on top.

**On device:** stars look right over the dark bg; the day gradient reads as sky; no perf hitch
in Auto+Range.

## 7. Risks + fallbacks

- **Stars through the wheel center.** Accepted (brainstorm chose full backdrop). Fallback: mask
  to outside the wheel later if it reads as cluttered.
- **`preserveAspectRatio="none"` stretches stars** into slight ellipses on tall screens — matches
  the web; negligible at this size. Fallback: square viewBox + scale if needed.
- **Per-frame opacity in Auto+Range.** Only two `opacity` props change; stars are memoized. Cheap.

## 8. Out of scope

`feTurbulence` clouds. Sky masking. (3c is complete after this slice — full web parity on mobile.)
