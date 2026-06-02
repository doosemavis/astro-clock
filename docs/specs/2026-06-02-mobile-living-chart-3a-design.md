# Slice 3a — Mobile Living Chart (Core) Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm); spec under review
**Author:** moosedavis + Claude

---

## 1. Concept

Make the mobile chart *live*. Today the wheel shows a fixed natal ring plus a "now"
ring frozen at app launch (it never moves). This slice brings the product's core
differentiator — **the visual, moving chart** — to mobile: the moveable glyphs advance
in real time, jump to any chosen instant, and animate across a time window. A bottom
sheet holds the controls so the wheel stays the hero and can be screenshot full-bleed.

This is **sub-slice 3a** of a decomposed "full web parity" goal. The web app
(`apps/web/components/Chart/*`) already implements the complete living chart; mobile
ports it in three sub-slices:

- **3a (this spec):** animation + Birth / Now / Date / Range views + the bottom-sheet
  control surface + 12h/24h + major/minor aspect toggles.
- **3b:** Compare (two-wheel view, stacked + side-by-side).
- **3c:** light/dark/auto theme with sun-altitude day/night sky + per-planet glyph
  visibility grid.

## 2. Goals

- Four views, selected from a bottom sheet:
  - **Birth** — static natal chart (today's behavior; the default view).
  - **Now** — moveable glyphs at the real current moment, ticking live.
  - **Date** — moveable glyphs held at a user-picked instant.
  - **Range** — moveable glyphs animating across a `[from, to]` window with play / pause /
    loop / restart and six speed presets.
- A readout of the moveable layer's current date / time / timezone.
- 12h/24h time-format toggle and Major / Minor aspect toggles.
- **No new dependencies.** Reuse the Slice-2 native date picker; build the sheet on
  React Native's built-in `Animated` + `PanResponder`.

## 3. Non-goals (deferred)

Compare / two-wheel (3b) · light/auto theme + day-night sky visuals + per-planet
visibility grid (3c) · a manual scrub slider (the web has none — Range position
auto-advances; bounds are set by the From/To pickers).

## 4. Approach — port the web's pure logic, re-skin the controls for touch

The web keeps all astronomy in `@astro/engine` and all interactive state in a thin React
layer (`chartModel.ts`, `useAnimationFrame.ts`, `Panel.tsx`, `Chart.tsx`). Mobile reuses
the engine verbatim and ports the **pure** view-model glue; only the control *presentation*
is re-authored for a phone (bottom sheet instead of a fixed left panel).

### 4.1 View model — `lib/chartModel.ts` (ported, Compare removed)

- `Mode = "birth" | "now" | "moment" | "range"`
- `resolveDate(mode, birthMs, momentMs, rangeStart, rangeEnd, pos)` — verbatim. Range =
  linear interpolation across `[start, end]` by `pos` (0→1).
- `PACES` — the six playback speeds (≈1 hr/s … ≈1 month/s), verbatim.
- `fmtDate` / `fmtTime` (12h/24h) / `readoutTz` / `actualOffset` — verbatim. These use
  `Intl` + engine `tzAbbrev` / `formatOffset`; Hermes `Intl` was validated on-device in
  Slice 2.
- `TimeFormat = "12h" | "24h"`.

### 4.2 Animation — `lib/useAnimationFrame.ts` + `hooks/useChartClock.ts`

- `useAnimationFrame(cb, active)` — ported from web. `requestAnimationFrame` (supported by
  React Native), `dt` clamped to ≤ 0.25 s so a backgrounded app can't fast-forward Range.
- `useChartClock()` owns the interactive time state — `mode`, `playing`, `loop`, `rate`,
  `pos`, `momentMs`, `rangeStartMs`, `rangeEndMs` — and exposes a single `displayInstant`
  (a `Date`) plus setters. The screen computes
  `livePositions = useMemo(() => positions(displayInstant), [displayInstant])`.
  - **Now:** advance via a 1 Hz timer (real planetary motion per second is imperceptible,
    so 1 Hz is visually smooth *and* battery-friendly — this is the one deliberate
    departure from the web, which uses rAF for Now).
  - **Range + playing:** rAF advances `pos` by `rate · dt / (end − start)`; at `pos ≥ 1`,
    loop restarts or playback stops, per the web.
  - **Birth / Date:** static; no loop runs.

### 4.3 Control surface — `components/BottomSheet.tsx` + `components/chart/ChartControls.tsx`

- **`BottomSheet`** — a draggable sheet built on `Animated` (translateY) + `PanResponder`,
  mirroring the drop-in pattern already used by `BirthForm`. Collapsed by default to a
  compact bar; drag/tap to expand; swipe down to dismiss to a full-bleed wheel.
  Dismissing only hides the controls — it does not change the mode or stop Range
  playback; the wheel keeps animating underneath.
- **`ChartControls`** — the sheet's contents:
  - **Collapsed:** grab handle + readout (date/time/tz) + the mode switcher.
  - **Expanded:** the active mode's controls, plus the 12h/24h and Major/Minor toggles.
    - **Date** → native `DateTimePicker` (the Slice-2 dependency) sets the moment.
    - **Range** → From / To pickers, Play/Pause, Loop, Restart, and six speed chips
      (`PACES`). Mirrors the web Panel's Range section one-to-one.
- **`components/Segmented.tsx`** — a small reusable segmented control (used for the mode
  switcher and the time-format toggle).

### 4.4 Aspects + readout

- Extend `components/chart/AspectLayer.tsx` to accept `showMajor` / `showMinor` and select
  lines via engine `findAspects(pos, { major, minor })` (already classifies each aspect by
  `tier`). `ChartWheel` passes the two flags through. Default both on (current behavior).
- The readout shows the moveable layer's date / time / tz via the ported `fmt*` helpers —
  ticking in Now, fixed in Date, advancing in Range, the birth-zone wall clock in Birth.

### 4.5 Screen wiring — `App.tsx`

Replace the one-shot `livePos = positions(launchedAt)` with the `useChartClock`-derived
`displayInstant`; mount the `BottomSheet` over the wheel. `natalPositions` stays driven by
`birthInstant(birth)` exactly as today. `Dial` and `NatalLayer` remain memoized and static;
only `LiveLayer` + `AspectLayer` re-render as `displayInstant` changes.

## 5. Files

| File | Action | Notes |
|---|---|---|
| `lib/chartModel.ts` (+ `.test.ts`) | new | ported pure helpers (Mode, `resolveDate`, `PACES`, `fmt*`, `actualOffset`) |
| `lib/useAnimationFrame.ts` | new | ported rAF hook |
| `hooks/useChartClock.ts` | new | owns time/mode state → `displayInstant` |
| `components/BottomSheet.tsx` | new | `Animated` + `PanResponder` sheet |
| `components/chart/ChartControls.tsx` | new | mode switcher + per-mode controls + toggles |
| `components/Segmented.tsx` | new | segmented control |
| `components/chart/AspectLayer.tsx` | edit | `showMajor` / `showMinor` props via `findAspects` |
| `components/chart/ChartWheel.tsx` | edit | pass aspect-toggle props through |
| `App.tsx` | edit | wire `useChartClock`; mount the sheet |

## 6. Verification

**What I verify here (no device):**
1. `apps/mobile` typechecks (`pnpm --filter @astro/mobile typecheck`).
2. **Unit tests** (`node --test --experimental-strip-types`, the Slice-2 runner) for the
   pure helpers: `resolveDate` (Birth/Now/Moment exact; Range at `pos` = 0 / 0.5 / 1),
   `PACES` values, `fmtTime` 12h vs 24h, `actualOffset`.
3. `npx expo export --platform android` bundles (Metro resolves everything; no new native
   modules).
4. Web-target render via `/browse`: switch modes, confirm Now ticks, Range plays/loops, the
   natal/live SVG positions update.

**What the user verifies on-device:** Now advances; Date jumps to a picked instant; Range
plays / pauses / loops / restarts at each speed; the bottom sheet drags and swipes to
dismiss for a clean full-screen wheel; 12h/24h and Major/Minor toggles work.

## 7. Risks + fallbacks

- **Range render performance on Hermes.** `positions()` is cheap Schlyter trig for ~10
  bodies and only `LiveLayer` + `AspectLayer` re-render, but per-frame `react-native-svg`
  updates could stutter on low-end devices. Fallback: throttle Range to ~30 fps via a
  frame-skip in `useAnimationFrame`.
- **Bottom-sheet feel without a gesture library.** `Animated` + `PanResponder` is lighter
  than `reanimated`/`gesture-handler` and matches `BirthForm`, but the drag may feel less
  fluid. Fallback: tap-to-expand/collapse always works even if the drag is rough; adopt a
  gesture library later only if the feel demands it.
- **rAF in the background.** Mitigated by the inherited `dt ≤ 0.25 s` clamp; the loop is
  gated on `active` so it stops outside Range playback.

## 8. Out of scope (later sub-slices)

Compare / two-wheel view (3b). Light/dark/auto theme, sun-altitude day/night sky, and the
per-planet glyph visibility grid (3c). Manual scrub slider. Saved/multiple charts, auth,
and cloud sync remain on the longer roadmap.
