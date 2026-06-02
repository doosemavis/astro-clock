# Slice 3c-ii — Mobile Per-Planet Visibility Grid Design

**Date:** 2026-06-02
**Status:** Approved (brainstorm); spec under review
**Author:** moosedavis + Claude

---

## 1. Concept

Let the user hide/show each planet independently on the two rings of the mobile chart —
the **Fixed** (natal/birth) ring and the **Moving** (live) ring — from a checkbox grid in
the bottom sheet. Hiding a moving planet also drops its aspect lines. Default: everything
visible (today's behavior). Ports the web's per-planet visibility (`Vis` / `VisMap`).

This is **sub-slice 3c-ii**, the second of three completing full web parity:

- **3c-i (shipped):** Light/Dark/Auto theme.
- **3c-ii (this spec):** per-planet glyph visibility grid.
- **3c-iii:** sun-altitude day/night sky (starfield + clouds).

## 2. Goals

- A **Glyphs** section in the sheet: an **All** row (toggle all Fixed / all Moving) and one
  row per planet (glyph + name + a **Fixed** checkbox + a **Moving** checkbox).
- Per-planet, per-ring control with **web parity** granularity (Fixed and Moving are
  independent — e.g. show natal Mars while hiding transiting Mars).
- Hidden glyphs disappear from their ring; an aspect line drops when **either** endpoint's
  **moving** planet is hidden (mirrors the web `AspectLayer`).
- Default **all visible**.
- **No new dependencies.**

## 3. Non-goals (deferred)

- Day/night sky (**3c-iii**).
- Persisting the visibility choice across launches (small follow-up, with the theme/zone
  persistence notes).
- A per-aspect or per-sign filter (only per-planet, as on web).

## 4. Approach — port the web `Vis` model; filter in the layers

### 4.1 Types + pure helpers — `lib/chartModel.ts` (edit, + test)

```ts
import type { PlanetKey } from "@astro/engine"; // type-only, keeps chartModel engine-free
export type Layer = "natal" | "live";
export type VisMap = Record<PlanetKey, boolean>;
export interface Vis { natal: VisMap; live: VisMap; }

/** Every planet visible. */
export function allVisible(keys: PlanetKey[]): VisMap { /* keys.reduce(... true) */ }

/** Immutable toggle. key="all" flips the whole layer to the opposite of "all currently on".
 *  Returns a new Vis (never mutates). */
export function toggleVis(vis: Vis, key: PlanetKey | "all", layer: Layer): Vis;
```

`allVisible` needs the planet list; importing the **value** `PLANET_KEYS` would pull engine
runtime into `chartModel` (which is kept engine-free for the strip-types test runner). To
stay testable, `allVisible(keys)` takes the key list as data and `toggleVis` operates on the
keys already present in the maps. `App` passes `PLANET_KEYS`. The unit-tested core is the
pure `toggleVis` / `allVisible`.

### 4.2 Layer filters (optional props → green at every step)

Add an **optional** visibility prop to each layer; `undefined` means "show all", so existing
callers are unaffected until they pass it:

- `NatalLayer` — `vis?: VisMap`; skip a glyph when `vis && !vis[key]`.
- `LiveLayer` — `vis?: VisMap`; same.
- `AspectLayer` — `visLive?: VisMap`; filter `findAspects(...)` to pairs where
  `!visLive || (visLive[a] && visLive[b])`.

### 4.3 Threading

- `ChartWheel` — `vis?: Vis`; passes `vis?.natal` → `NatalLayer`, `vis?.live` →
  `LiveLayer` + `AspectLayer`.
- `CompareWheel` — `vis?: VisMap`; passes it to its `LiveLayer` + `AspectLayer`. The Compare
  wheels render the moment's moving glyphs, so they use the **`live`** map.
- `CompareView` — `vis?: VisMap`; forwards to both wheels.
- `App` — `const [vis, setVis] = useState<Vis>(() => ({ natal: allVisible(PLANET_KEYS), live: allVisible(PLANET_KEYS) }))`; passes `vis` to `ChartWheel`, `vis.live` to `CompareView`, and `vis` + `onToggleVis` to `ChartControls`.

### 4.4 Grid UI — `components/chart/VisGrid.tsx` (new)

A themed component (`useTheme` + `makeStyles(palette)`, per 3c-i):
- Header row: blank + `Fixed` + `Moving` labels.
- **All** row: a `Check` for "all natal on" and one for "all live on" (on = every key true).
- One row per `PLANET_KEYS[key]`: `{PLANET_GLYPH[key]} {cap(key)}` + Fixed `Check` + Moving `Check`.
- `Check` = a small `Pressable` square that shows a ✓ (palette `live` on, `border` off).
- Props: `{ vis: Vis; onToggle: (key: PlanetKey | "all", layer: Layer) => void }`.

Rendered as a `Section label="Glyphs"` in `ChartControls`.

### 4.5 Controls + screen — `ChartControls.tsx`, `App.tsx`

- `ChartControls` gains `vis: Vis; onToggleVis: (key, layer) => void;` props and renders
  `<Section label="Glyphs"><VisGrid vis={vis} onToggle={onToggleVis} /></Section>` (after
  Aspects).
- `App` owns `vis` state; `onToggleVis = (key, layer) => setVis((v) => toggleVis(v, key, layer))`.

## 5. Files

| File | Action | Notes |
|---|---|---|
| `lib/chartModel.ts` (+ test) | edit | `Vis`/`VisMap`/`Layer` types; `allVisible(keys)` + `toggleVis` (TDD) |
| `components/chart/NatalLayer.tsx` | edit | optional `vis?: VisMap` filter |
| `components/chart/LiveLayer.tsx` | edit | optional `vis?: VisMap` filter |
| `components/chart/AspectLayer.tsx` | edit | optional `visLive?: VisMap` filter |
| `components/chart/ChartWheel.tsx` | edit | `vis?: Vis` → natal/live |
| `components/chart/CompareWheel.tsx` | edit | `vis?: VisMap` → its LiveLayer/AspectLayer |
| `components/chart/CompareView.tsx` | edit | forward `vis?: VisMap` to wheels |
| `components/chart/VisGrid.tsx` | new | the themed checkbox grid |
| `components/chart/ChartControls.tsx` | edit | Glyphs section + `vis`/`onToggleVis` props |
| `App.tsx` | edit | `vis` state + `toggleVis`; thread to wheel/compare/controls |

## 6. Verification

**Here (no device):**
1. **Unit tests** (`node --test`): `allVisible` all-true; `toggleVis` flips one planet on the
   right layer only (immutably, other layer/keys untouched); `toggleVis(..., "all", layer)`
   turns the whole layer off when all were on, and on otherwise.
2. `pnpm --filter @astro/mobile typecheck` clean; mobile + engine suites green.
3. `npx expo export --platform android` bundles.
4. Web `/browse` (390×844): open **Glyphs**; uncheck a planet's **Moving** → its inner glyph
   and any aspect line to it disappear; uncheck **Fixed** → its outer (natal) glyph
   disappears; **All** toggles clear/restore a ring; Compare wheels honor the moving map.

**On device:** the grid is tappable/legible; toggles affect Birth/Now/Range/Compare.

## 7. Risks + fallbacks

- **Grid density** (~10 rows × 2 checks) in the sheet. Mitigation: compact rows; the sheet
  scrolls. Fallback: collapse the grid behind a disclosure if it crowds the sheet.
- **`chartModel` engine-free constraint.** Keep `PLANET_KEYS` out of `chartModel` (pass keys
  in) so the strip-types unit tests still run; the only engine-touching glue (`PLANET_GLYPH`
  in `VisGrid`) lives in the render-verified component, not the tested module.
- **Memoized layers + new prop.** Passing `vis` re-renders them when visibility changes
  (intended); stable otherwise. No correctness risk.

## 8. Out of scope (later)

Day/night sky (**3c-iii**). Persisting visibility. Auth / cloud sync. Synastry (→ Pro).

## 9. Addendum — header avatar (folded into this slice)

Per a mid-slice request, also replace the header **"Your chart ✎"** text affordance with a
circular **Avatar** whose default image is the user's **Sun-sign** zodiac glyph (e.g. ♌ for a
Leo Sun). Tapping the avatar opens the birth form, exactly as the text button did. The
component is built so a real uploaded photo can replace the default glyph later.

- **Engine:** add `SIGN_GLYPH: Record<Sign, string>` (the 12 zodiac symbols ♈…♓, keyed to the
  existing `SIGNS`) next to `PLANET_GLYPH`, and export it. Static map — no test (mirrors
  `PLANET_GLYPH`).
- **`components/Avatar.tsx` (new):** a themed (`useTheme`) circular view — `borderRadius`
  = `size/2`, `live`-colored ring, `panel` fill — rendering a glyph in the bundled
  `GLYPH_FONT`. Props `{ glyph: string; size?: number }`. (A future `imageUri?: string` would
  render an `<Image>` instead of the glyph.)
- **`App.tsx`:** compute `sunGlyph = SIGN_GLYPH[signOf(natalPos.sun) as Sign]`; in the header,
  replace the `Pressable`/text with a `Pressable onPress={() => setEditing(true)}` wrapping the
  name + `<Avatar glyph={sunGlyph} />` (avatar on the right). The big-three line under the
  brand is unchanged.
- **Verify:** avatar shows the Sun-sign glyph (♌ for the default Jonesboro chart, Sun in Leo);
  tapping opens the form; the circle re-themes in Light/Dark.

Files added to §5: `packages/engine/src/types.ts` (+ `index.ts` export) for `SIGN_GLYPH`;
new `apps/mobile/components/Avatar.tsx`; `App.tsx` header edit.

## 10. Addendum — time-format consistency (folded into this slice)

Two more mid-slice requests, both about the 12h/24h time format:

1. **The global Clock toggle must reformat the settings-panel time inputs**, not just the
   on-chart readout. `ChartControls`' `DateField` will take a `timeFormat` prop and format its
   time string accordingly (12h → `hour12`, 24h → `hourCycle: "h23"`, both `padHour`'d).
   `ChartControls` passes the existing `timeFormat` to every `DateField`. This affects the
   views with a time input — **Date** (moment) and **Compare** (Chart A / Chart B). Range
   From/To are date-only and unchanged.

2. **The birth form gets its own 12h/24h toggle** for the birth-time field. The stored birth
   time stays canonical `HH:MM` (24h) in `BirthData`; the toggle only changes how the time is
   *displayed* on the field. `BirthForm` gains a `Segmented` (Clock 12h/24h), a local
   `birthTf` state seeded from the app's current `timeFormat` (passed as a prop) but
   independently toggleable, and a small `HH:MM → display` formatter.

Files added to §5: `apps/mobile/components/chart/ChartControls.tsx` (`DateField` `timeFormat`);
`apps/mobile/components/BirthForm.tsx` (own 12h/24h toggle); `apps/mobile/App.tsx` (pass
`timeFormat` to `BirthForm`).
