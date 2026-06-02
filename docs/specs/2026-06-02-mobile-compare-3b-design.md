# Slice 3b — Mobile Compare (Two Charts) Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm); spec under review
**Author:** moosedavis + Claude

---

## 1. Concept

Bring the web's **Compare** view to mobile: two independent single-moment charts shown
together, so the user can hold two moments side-by-side — their birth chart against today,
two birthdays against each other, a wedding date against a transit, etc.

Compare becomes the **fifth mode** of the living chart (Birth · Now · Date · Range ·
**Compare**), selected from the same bottom sheet built in Slice 3a. The web renders the
two wheels with a `Side | Stacked` layout toggle. On a portrait phone, side-by-side makes
each wheel unreadably small (~180 px), so mobile re-frames the presentation around a
**`Both | Pages`** toggle that adds a mobile-native page-turn the web does not have:

- **Both** (default) — the two wheels **stacked** vertically, both visible for at-a-glance
  comparison.
- **Pages** — a horizontal **swipe pager**: page 1 = Chart A full-size, page 2 = Chart B
  full-size, with page dots. Swipe to turn between them and study each chart at full size.

This is **sub-slice 3b** of the decomposed "full web parity" goal:

- **3a (shipped):** animation + Birth / Now / Date / Range + the bottom sheet.
- **3b (this spec):** Compare — two-wheel view, same-page (stacked) + page-turn (pager).
- **3c:** light/dark/auto theme with sun-altitude day/night sky + per-planet glyph
  visibility grid.

## 2. Goals

- A **Compare** mode added to the bottom-sheet mode switcher.
- **Two independent charts:**
  - **Chart A** defaults to the **birth instant** (so it reads as the birth chart);
    editable via its own date/time picker.
  - **Chart B** defaults to **now** (seeded at app launch, mirroring web); editable via
    its own date/time picker.
  - Each wheel *is* a chart for its own moment: the zodiac **Dial**, that moment's planets
    (**LiveLayer**), and that wheel's **own** internal aspects (**AspectLayer**). No fixed
    natal overlay.
- A **`Both | Pages`** view toggle inside the Compare controls:
  - **Both** → two wheels stacked, each with its own caption (`Chart A · <date·time·tz>`).
  - **Pages** → full-size horizontal pager (Chart A, Chart B) with page dots.
- The existing **Major / Minor** aspect toggles and **12h / 24h** format apply to **both**
  wheels (global, exactly as in 3a).
- Per-wheel captions show each moment's `date · time · tz` in the **viewer's local zone**
  (web parity — formatted with the existing `"moment"`-mode helpers).
- **No new dependencies.** The pager is React Native's built-in
  `ScrollView` (`horizontal` + `pagingEnabled`); page dots are plain views. Date pickers
  reuse the Slice-2 native picker already used by Date/Range.

## 3. Non-goals (deferred)

- **Cross-chart synastry** — aspect lines *between* Chart A's and Chart B's planets. The
  web does not have it; it is net-new engine work. Deferred to a **post-launch Pro
  feature** (recorded in memory `synastry-pro-feature`). Each wheel shows **own-aspects
  only**.
- **`Side` layout** — dropped on mobile portrait (unreadable at phone width). "Both" is
  stacked-only; "Pages" is the full-size single view.
- **Animation in Compare** — Compare is **static**, like the web; each wheel is computed
  directly from its moment. No Now-tick or Range-rAF runs in Compare.
- **3c** — themes, sun-altitude day/night sky, per-planet visibility grid.

## 4. Approach — port the web's two-wheel model, re-skin presentation for touch

The web keeps Compare's astronomy in `@astro/engine` (`positions(date)` per wheel) and the
two moments in React state (`compareAMs`, `compareBMs`). Mobile reuses the engine verbatim
and ports the wheel + the two-moment state; only the *presentation* of the pair (stacked vs
paged) is re-authored for a phone.

### 4.1 View model — `lib/chartModel.ts` (edit)

- Extend `Mode` to `"birth" | "now" | "moment" | "range" | "compare"`.
- Add `export type CompareView = "both" | "pages";` (mobile-specific; replaces the web's
  `CompareLayout`).
- Add a pure `pageIndex(offsetX, pageWidth, count)` helper (scroll offset → current page,
  clamped to `[0, count − 1]`) for the pager's dots. It lives here, alongside `resolveDate`
  / `PACES`, because `chartModel.ts` is engine-free and therefore unit-testable under the
  strip-types runner.

### 4.2 Caption helper — `lib/readout.ts` (edit)

- Add `cmpCaption(ms: number, birth: BirthData, timeFormat: TimeFormat): string`, mirroring
  the web's `cmpCaption`: it formats with the **`"moment"` mode** (viewer's local zone),
  reusing the existing `fmtDate` / `fmtTime` / `readoutTz` (so it inherits leading-zero hours
  and the 12h/24h preference). `birth` is required only because those existing signatures
  take it; in `"moment"` mode the birth zone is not read, so the app's current `birth` is
  passed through. Like the rest of `readout.ts` (which statically imports engine runtime),
  `cmpCaption` is **verified via render**, not a unit test — the engine-free, unit-tested
  helper for this slice is `pageIndex` in `chartModel.ts`.

  ```
  cmpCaption(ms, birth, tf) =>
    `${fmtDate(d, "moment", birth)} · ${fmtTime(d, "moment", birth, tf)} ${readoutTz(d, "moment", birth)}`
  ```

  `App.tsx` passes the app's current `birth`, as on web.

### 4.3 Compare state — `hooks/useChartClock.ts` (edit)

Add to the clock's state and `ChartClock` interface:

- `compareAMs: number` — `useState(birthMs)`.
- `compareBMs: number` — `useState(() => Date.now())` (the now at app launch, web parity).
- `compareView: CompareView` — `useState<CompareView>("both")`.
- setters `setCompareA(ms)`, `setCompareB(ms)`, `setCompareView(v)`.
- When `birthMs` changes (birth edited/loaded), reset `compareAMs` to the new `birthMs`
  (mirrors the web's `applyBirth` → `setCompareAMs(birthInstant(b))`), via an effect keyed
  on `birthMs`. Keep it simple: reset A to `birthMs` whenever `birthMs` changes.
- **No loop in Compare.** The existing Now (1 Hz) and Range (rAF) loops are already gated on
  `mode === "now"` / `"range"`; `"compare"` triggers neither. `displayInstant` is unused in
  Compare (the screen reads `compareAMs` / `compareBMs` directly).

### 4.4 One wheel — `components/chart/CompareWheel.tsx` (new)

A self-contained chart for a single instant, porting the web `CompareWheel`:

- Props: `{ idPrefix: string; caption: string; subCaption: string; size: number;
  pos: Positions; showMajor: boolean; showMinor: boolean }`.
- Renders the caption (`caption` bold + `subCaption` muted) above an `<Svg>` containing
  `Dial` (with `idPrefix` so two wheels' gradient/clip ids never collide), `AspectLayer`
  (own-aspects, `showMajor`/`showMinor`), and `LiveLayer` (the moment's planets).
- No tooltip/hover (touch); tapping a glyph is out of scope here (web's hover is desktop).
- `size` is supplied by `CompareView` so the same wheel renders small (Both) or full (Pages).

> **Dependency:** `Dial`, `AspectLayer`, `LiveLayer` must accept an `idPrefix` (or be
> verified collision-free) so two instances can coexist in one screen. If `Dial` hardcodes
> gradient/clip ids, thread an `idPrefix` prop through it and `LiveLayer`/`AspectLayer`. The
> plan's first task audits these three components and adds `idPrefix` where needed.

### 4.5 The pair — `components/chart/CompareView.tsx` (new)

Arranges the two `CompareWheel`s per `compareView`:

- **Both** — a vertical column: Chart A wheel above Chart B wheel, each sized to
  `floor((availableHeight − captions − gaps) / 2)` capped to width, so both fit above the
  collapsed sheet.
- **Pages** — a horizontal `ScrollView` (`horizontal`, `pagingEnabled`,
  `showsHorizontalScrollIndicator={false}`) with two full-width pages (each a full-size
  `CompareWheel`), plus a **page-dots** row (`● ○`) below. Current page tracked via
  `onMomentumScrollEnd` using the engine-free `pageIndex(offsetX, pageWidth, count)` helper
  from `chartModel.ts` (`Math.round(offsetX / pageWidth)` clamped to `[0, count − 1]`).
- Props: `{ posA; posB; captionA; captionB; subA; subB; view; size: { both; full };
  showMajor; showMinor }`.

### 4.6 Controls — `components/chart/ChartControls.tsx` (edit)

- Add `{ key: "compare", label: "Compare" }` to the mode switcher. With five modes the
  `Segmented` row must not overflow at 390 px: allow it to **wrap to two rows**
  (`flexWrap: "wrap"`) — verify the existing `Segmented` wraps; if it clips, add
  `flexWrap` to its container.
- Add a bordered **Compare** `Section` (shown only when `mode === "compare"`), matching the
  Date/Range sections:
  - **View** — a `Segmented` `Both | Pages` bound to `compareView` / `setCompareView`.
  - **Chart A** — a `DateField` bound to `compareAMs` / `setCompareA`.
  - **Chart B** — a `DateField` bound to `compareBMs` / `setCompareB`.
  - A short note: *"Chart A starts at your birth moment, Chart B at now — change either to
    compare two date/times."* (ported from the web Panel).

### 4.7 Screen wiring — `App.tsx` (edit)

- Compute, only when in Compare (cheap, memoized on the two ms values):
  `compareAPos = useMemo(() => positions(new Date(compareAMs)), [compareAMs])` and likewise
  `compareBPos`.
- Build `cmpCaption` (closing over `birth` + `timeFormat`) and derive `subA`/`subB`.
- When `clock.mode === "compare"`: render `<CompareView ...>` in the chart area **instead of**
  the single `ChartWheel`, and **hide the global readout pill** (each wheel carries its own
  caption). The signature glyphs under the brand and the header stay as-is.
- Otherwise: today's single-wheel render is unchanged.
- The `RangeHud` floating pill remains Range-only (unaffected).

## 5. Files

| File | Action | Notes |
|---|---|---|
| `lib/chartModel.ts` (+ test) | edit | add `"compare"` to `Mode`; add `CompareView` type; add `pageIndex(offsetX, pageWidth, count)` + unit tests |
| `lib/readout.ts` | edit | add `cmpCaption(ms, birth, timeFormat)` (local zone, web parity; verified via render) |
| `hooks/useChartClock.ts` | edit | `compareAMs` / `compareBMs` / `compareView` + setters; A resets on birth change; no loop in Compare |
| `components/chart/CompareWheel.tsx` | new | one self-contained wheel (Dial + AspectLayer + LiveLayer + caption), `size` + `idPrefix` |
| `components/chart/CompareView.tsx` | new | Both (stacked) / Pages (`ScrollView` pager + dots, via `pageIndex`) |
| `components/chart/Dial.tsx` | edit | add `idPrefix` prop, prefix the `acSignArc{s}` `<Defs>` ids so two wheels don't collide (LiveLayer/AspectLayer use no SVG ids — unchanged) |
| `components/Segmented.tsx` | edit | optional `wrap` prop (let the 5-mode switcher wrap to two rows) |
| `components/chart/ChartControls.tsx` | edit | Compare in mode switcher (wrap to 2 rows) + Compare section (View toggle + A/B `DateField`s) |
| `App.tsx` | edit | render `CompareView` in Compare; hide global pill; memo `compareAPos`/`compareBPos` |

## 6. Verification

**What I verify here (no device):**

1. `apps/mobile` typechecks (`pnpm --filter @astro/mobile typecheck`).
2. **Unit tests** (`node --test --experimental-strip-types`, the Slice-2/3a runner):
   - `pageIndex(offsetX, pageWidth, count)` — page 0, midpoint rounding to the next page,
     and clamping at both ends.
   - (`cmpCaption` is verified via render in step 4, not unit-tested — `readout.ts` imports
     engine runtime, matching that module's existing render-verified pattern.)
3. `npx expo export --platform android` bundles (Metro resolves everything; no new native
   modules).
4. Web-target render via `/browse` (390×844): switch to Compare → two stacked wheels with
   captions; toggle **Pages** → horizontal pager, swipe A↔B, dots update; edit Chart A and
   Chart B dates → the corresponding wheel's glyphs move; Major/Minor + 12h/24h affect both.

**What the user verifies on-device:** the page-turn feel (swipe + dots), stacked
readability, captions correct per wheel, each wheel's own aspects, and that Major/Minor +
12h/24h affect both wheels.

## 7. Risks + fallbacks

- **Two wheels' SVG ids collide.** `react-native-svg` gradient/clip/`<Def>` ids are global
  in a document; two `Dial`s with the same ids could cross-render. **Mitigation:** the
  `idPrefix` prop (Task 1 audits `Dial`/`LiveLayer`/`AspectLayer`). Fallback: if a layer has
  no shared ids, `idPrefix` is a no-op and the audit confirms it.
- **Stacked wheels too small.** Two wheels above the collapsed sheet are each roughly
  half-height. **Mitigation:** "Pages" gives full-size detail; "Both" is the glance view.
  Fallback: cap wheel size to width and accept vertical scrolling of the pair if needed.
- **Caption zone may surprise.** Per web parity, Chart A (birth instant) is shown in the
  **viewer's local zone**, so a Central-time birth viewed from Eastern reads one hour later
  than the birth wall-clock. **Decision (spec review): both captions use the local zone —
  web parity.** (If revisited, Chart A in its birth zone is a one-line change: `"birth"`
  mode for A's caption.)
- **`pagingEnabled` feel without a gesture lib.** `ScrollView` paging is built-in and
  snappy; if the feel disappoints, a gesture library is a later, isolated swap (not now).

## 8. Out of scope (later sub-slices)

Cross-chart synastry (→ Pro, post-launch). `Side` layout. Light/dark/auto theme,
sun-altitude day/night sky, per-planet glyph visibility grid (3c). Glyph tap/tooltip on
mobile. Saved/multiple charts, auth, and cloud sync remain on the longer roadmap.

## 9. Amendments (post-build device feedback, 2026-06-02)

Two changes made after the first working build supersede the relevant text above:

1. **Per-wheel captions use the readout pill.** Each Compare wheel's `Chart A · date · time ·
   tz` caption now renders in the **same rounded, bordered, panel-filled pill** the other four
   views use (App's `moment` style), instead of the plain bold/muted text described in §4.4.

2. **Pages is a coin-flip, not a slide.** The Pages view no longer uses a horizontal
   `ScrollView` pager (§2, §4.5). Instead it shows one full-size wheel and **flips it 180°
   like a coin** (`Animated` `rotateY`, tap the chart or a dot) to reveal the other chart. A
   hard opacity cut at the edge-on midpoint swaps the faces (also covering platforms where
   `backfaceVisibility` doesn't hide native SVG). Because there is no scroll offset to map,
   the `pageIndex` helper and its unit tests (§4.1, §4.2, §6) were **removed** — the active
   dot is now driven directly by flip state. No new dependencies (`Animated` is built-in).
