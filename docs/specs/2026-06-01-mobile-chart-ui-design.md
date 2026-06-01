# Mobile App — Slice 1: Chart Wheel (Design)

**Date:** 2026-06-01
**Author:** moosedavis + Claude
**Status:** Approved (brainstorm); pending implementation plan
**Part of:** the MoveStar Android app build (slice 1 of 6). Builds on Slice 0 (foundation).
Later slices: auth in RN, living views + settings, subscriptions (RevenueCat + Google
Play Billing), store launch.

---

## 1. Goal

Render the **natal chart wheel** natively in `apps/mobile`, using `react-native-svg`, by
**reusing `@astro/engine`** for all geometry, positions, palette, and aspect data. This is
the visual milestone: the real wheel (rings, sign labels, planet glyphs, aspect lines) on a
phone, matching the web wheel's look. It replaces the Slice-0 text screen.

The wheel renders the **sample birth** (`DEFAULT_BIRTH`) — entering *your own* birth and
loading *your* saved chart come later (auth = Slice 2, birth form = Slice 3). No
interactivity, no live/transiting ring, no theme switching yet (all later slices).

## 2. Decisions (locked)

- **Renderer:** `react-native-svg` (`Svg`, `Circle`, `Line`, `Path`, `Text`, `TextPath`,
  `G`, `Defs`). Installed via `npx expo install` so the version matches Expo SDK 54.
- **Glyph rendering:** bundle a symbols font (**Noto Sans Symbols**, OFL/free — covers
  `U+2600–2647`, all 10 planet glyphs `☉☽☿♀♂♃♄♅♆♇`) under `apps/mobile/assets/fonts/`,
  load it with `expo-font`, and render the glyphs as `<Text fontFamily="NotoSansSymbols">`.
  Android's default font lacks these symbols (they would render as `□`); a bundled font is
  the reliable cross-platform fix. The plan verifies all 10 glyphs render before locking the
  font in; fallback is a different symbols font, or per-glyph SVG paths for any missing one.
- **Sign labels:** the Latin sign names (`Aries`…`Pisces`) render in the default font (no
  symbol-font dependency). Drawn **curved** along each sign arc with `TextPath` + the
  engine's `arcPath`, matching the web. **Fallback:** if Android's `TextPath` misrenders,
  fall back to straight tangential labels at each sign's mid-angle (a `<Text>` rotated to
  the arc). The fallback is a known, acceptable v1 look — decided at first device/web render.
- **Colors:** import the engine's **`NIGHT`** palette and **`aspectColor(def, 0)`** directly
  — no hardcoded hex in mobile code. (`NIGHT` and `aspectColor` are already exported from
  `@astro/engine`.) Light/Auto theming is Slice 3.
- **Scope:** static natal-only wheel. No gestures, no animation, no settings panel, no
  navigation library (still one screen — YAGNI until Slice 3 adds views).

## 3. Architecture

### 3.1 Data flow

```
DEFAULT_BIRTH ──birthInstant()──> Date
                  │
                  ├─ positions(date) ─────────────> natal Positions (10 longitudes)
                  └─ ascendant(date, lat, lon) ───> Asc longitude  (kept for later; the
                                                     static wheel doesn't rotate to it yet)
natal Positions ──> ChartWheel ──> Dial + NatalLayer + AspectLayer  (one <Svg>)
```

`App.tsx` computes the natal positions once, gates rendering on the font load, then renders
`<ChartWheel positions={np} />`. All trig/coordinates come from the engine — the RN
components contain **no astronomy and no magic geometry**, only SVG element mapping.

### 3.2 Engine reuse (no re-derivation)

| Need | Engine export |
|------|---------------|
| Ring/label/glyph radii | `R` (`{ outer, signInner, signLabel, natalGlyph, natalTick, aspect, … }`) |
| Center, viewBox basis | `CX`, `CY` (500,500 → `viewBox="0 0 1000 1000"`) |
| Point on a ring at a longitude | `polar(r, lon) -> [x,y]` |
| Arc / curved-label path string | `arcPath(r, lonFrom, lonTo, sweep)` |
| Anti-overlap glyph angles | `declutter(positions, gap) -> Record<PlanetKey, lon>` |
| Sign of a longitude / sign list | `signOf(lon)`, `SIGNS` |
| Planet order + symbols | `PLANET_KEYS`, `PLANET_GLYPH` |
| Aspect detection + color | `findAspects(positions)` (or `aspectBetween`), `aspectColor(def, 0)`, `ASPECT_DEFS` |
| Dark palette | `NIGHT` (`bg/panel/line/sign/natal/border/text…`) |

### 3.3 Components (all new, `apps/mobile/components/chart/`)

Each file has one responsibility and takes plain props — understandable and testable in
isolation. They mirror the web `components/Chart/` layers, re-expressed in `react-native-svg`.

- **`palette.ts`** — chart constants: `export const C = NIGHT` plus stroke widths / font
  sizes / glyph radius tweaks used across layers (single source, no magic numbers in JSX).
- **`Dial.tsx`** — the static frame: outer ring + `signInner` ring (`Circle`), 12 sign
  boundary spokes and degree ticks (`Line` via `polar`), and the 12 curved sign labels
  (`Defs` + `Path` from `arcPath` + `TextPath`). Props: none (pure frame) or `{ size }`.
- **`NatalLayer.tsx`** — the 10 natal planet glyphs at `R.natalGlyph`, positions passed
  through `declutter` so they don't collide, each with a short leader tick from the ring to
  the glyph. Renders glyphs as `<Text fontFamily="NotoSansSymbols">{PLANET_GLYPH[key]}</Text>`.
  Props: `{ positions }`.
- **`AspectLayer.tsx`** — lines between natal planets at `R.aspect`, one `<Line>` per aspect
  from `findAspects(positions)`, stroked with `aspectColor(def, 0)`. Props: `{ positions }`.
- **`ChartWheel.tsx`** — the `<Svg viewBox="0 0 1000 1000">` container sized to a responsive
  square (min of screen width/height minus padding, via `useWindowDimensions`), painting
  background `C.panel`, then `<AspectLayer/>`, `<Dial/>`, `<NatalLayer/>` in z-order
  (aspects under the dial, glyphs on top). Props: `{ positions }`.

### 3.4 Screen + font loading (`App.tsx`)

```
useFonts({ NotoSansSymbols: require("./assets/fonts/NotoSansSymbols-Regular.ttf") })
if (!loaded) return <SplashGate/>            // dark screen, no glyph render before font ready
np = positions(birthInstant(DEFAULT_BIRTH))
return <View bg=NIGHT.bg> "MoveStar" + <ChartWheel positions={np}/> </View>
```

The font gate is required: rendering glyph `<Text>` before the font loads would flash
tofu/fallback. `expo-font`'s `useFonts` returns a `[loaded]` flag for exactly this.

## 4. Dependencies added

- `react-native-svg` — `npx expo install react-native-svg` (SDK-54 aligned).
- `expo-font` — `npx expo install expo-font`.
- `assets/fonts/NotoSansSymbols-Regular.ttf` — the bundled glyph font (committed asset).
- (Slice 0 already added `react-native-web` + `react-dom` for the web target.)

## 5. Verification

**What I can verify here (no device):**
1. `apps/mobile` **typechecks** (`pnpm --filter @astro/mobile typecheck`).
2. **`npx expo export --platform android`** bundles cleanly (Metro resolves `react-native-svg`
   + the engine; no unresolved modules).
3. **Web-target render + screenshot** — `expo start --web` (react-native-svg renders to DOM
   SVG under react-native-web), open it with the `/browse` skill, and screenshot the wheel so
   I can confirm it *looks right* (rings, curved labels, all 10 glyphs visible, aspect lines)
   and iterate on spacing/strokes before handing off. **This is the primary visual check** —
   the one slice where seeing it matters most.

**What the user verifies on-device (Expo Go):**
- `cd apps/mobile && pnpm start`, scan the QR in Expo Go, and confirm the wheel renders on
  the phone with the planet glyphs showing as real symbols (not `□`). Same walkthrough as
  Slice 0 (`--tunnel` fallback for locked-down Wi-Fi).

**Tests:** the engine geometry is already unit-tested in `packages/engine`. The RN layers are
thin SVG mappings of that tested geometry; their correctness is verified visually (web
screenshot + device), consistent with how the web wheel is verified. No new engine tests.

## 6. Risks + fallbacks

- **Font missing a glyph** (e.g. Pluto `♇`). Mitigation: plan verifies all 10 in the web
  render; fallback to an alternate symbols font or per-glyph SVG path.
- **`TextPath` on Android.** Mitigation: straight tangential sign labels (§2). Decided at
  first render.
- **`react-native-svg` version drift vs SDK 54.** Mitigation: install via `expo install`
  (never hand-pin), and `expo install --fix` if a mismatch warns.
- **Glyph baseline/anchoring differs between web SVG and react-native-svg** (RN needs explicit
  `textAnchor="middle"` + a `dy` for vertical centering; no CSS `dominant-baseline`).
  Mitigation: center via `textAnchor` + measured `dy`, tuned in the web render.

## 7. Out of scope (later slices)

Your-own birth input + loading saved charts (Slice 2/3), the live/transiting ring + animation,
Now/Date/Range/Compare views, the settings panel, Clock + theme toggles, light/Auto theming,
RevenueCat + Google Play Billing + paywall, EAS `.aab` build + store listing.
