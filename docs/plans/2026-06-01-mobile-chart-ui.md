# Mobile Chart Wheel (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the natal chart wheel (rings, sign labels, 10 planet glyphs, aspect lines) natively in `apps/mobile` with `react-native-svg`, reusing `@astro/engine` for all geometry/positions/palette/aspects, for the sample birth `DEFAULT_BIRTH`.

**Architecture:** Port the three web SVG layers (`Dial`, `NatalLayer`, `AspectLayer`) to `react-native-svg` primitives, composed in a `ChartWheel` inside one responsive `<Svg viewBox="0 0 1000 1000">`. The RN components carry **no astronomy and no hardcoded colors** — every coordinate comes from the engine's `polar`/`arcPath`/`declutter`/`R`, and every color from the engine's `NIGHT` palette and `aspectColor`. Planet glyphs render in a bundled symbols font (`@expo-google-fonts/noto-sans-symbols`) loaded via `expo-font`, gated so glyphs never paint before the font is ready. Verified here by typecheck + Android bundle + a web-target screenshot; the user confirms on-device via Expo Go.

**Tech Stack:** Expo SDK 54, React Native, `react-native-svg`, `expo-font`, `@expo-google-fonts/noto-sans-symbols`, `@astro/engine`, TypeScript.

**Spec:** `docs/specs/2026-06-01-mobile-chart-ui-design.md`

> Network note: `expo install` downloads native packages; `expo export`/`expo start --web` bundle hundreds of modules — expect minutes.

---

## File structure

**Create (all under `apps/mobile/`):**
- `components/chart/palette.ts` — dark palette alias + chart drawing constants + the glyph font family name. One source of truth; no magic numbers/hex in the layers.
- `components/chart/Dial.tsx` — static frame: rings, ticks, sign boundaries, sign labels (curved via `TextPath`, with a horizontal fallback behind a `curvedLabels` prop).
- `components/chart/AspectLayer.tsx` — aspect lines between natal planets.
- `components/chart/NatalLayer.tsx` — natal planet glyphs + leader ticks + tokens.
- `components/chart/ChartWheel.tsx` — composes the three layers into one responsive square `<Svg>`.

**Modify:**
- `apps/mobile/package.json` — add `react-native-svg`, `expo-font`, `@expo-google-fonts/noto-sans-symbols` (via `expo install`).
- `apps/mobile/App.tsx` — replace the Slice-0 text screen with the font gate + `<ChartWheel>`.

**Untouched:** `apps/web`, `packages/engine` (consumed as-is).

---

## Engine API reference (already implemented — do not re-derive)

These exports exist in `@astro/engine` and are verified. Use them; never reimplement the math.

- `R = { outer:472, signInner:404, signLabel:438, natalGlyph:373, natalTick:394, liveRing:330, liveGlyph:330, aspect:314 }`, `CX=500`, `CY=500`.
- `polar(r, lon) -> [x, y]` — screen point (y-down) at ring `r`, longitude `lon`.
- `arcPath(r, lonFrom, lonTo, sweep: 0|1) -> string` — SVG arc `d` for curved labels.
- `declutter(pos, gap=8) -> Record<PlanetKey, number>` — fanned-out glyph longitudes.
- `signOf(lon)`, `SIGNS` (`["Aries",…,"Pisces"]`), `PLANET_KEYS`, `PLANET_GLYPH` (`{sun:"☉",…}`).
- `aspectBetween(a, b) -> AspectDef | null`; `AspectDef = { angle, orb, tier:"major"|"minor", name, dark, light, dash, opacity, width }`.
- `aspectColor(def, t) -> string` (use `t=0` for dark).
- `NIGHT` palette: `{ bg:"#0c0e26", panel:"#0a0b22", border:"#272a52", text:"#e9eaf6", textDim:"#9a9cc0", seclabel:"#6f72a0", line:"#aeb2e0", sign:"#ccd0ef", natal:"#7a7da8", live:"#f2e7c2", bgEdge:"#05060f" }`.
- `DEFAULT_BIRTH`, `birthInstant(birth) -> Date`, `positions(date) -> Positions`.

**Web color → engine palette mapping** (from `apps/web/app/chart/chart.css`, lines 170–177):
`s-ring`/`s-tick`/`s-bound` stroke = `NIGHT.line`; `s-sign` fill = `NIGHT.sign`; `s-natal` fill + `s-ntick` stroke = `NIGHT.natal`; `s-ntoken` fill = `NIGHT.bg`, stroke = `NIGHT.natal`.

---

## Task 1: Install react-native-svg + the glyph font

**Files:** Modify `apps/mobile/package.json` (via CLI), root `pnpm-lock.yaml`

- [ ] **Step 1: Install the SDK-aligned packages**

Run (repo root):
```bash
cd apps/mobile && npx expo install react-native-svg expo-font @expo-google-fonts/noto-sans-symbols && cd ../..
```
Expected: `apps/mobile/package.json` `dependencies` now include `react-native-svg`, `expo-font`, and `@expo-google-fonts/noto-sans-symbols`, at versions Expo selects for SDK 54. (`expo install` picks compatible versions — never hand-pin.)

- [ ] **Step 2: Relink the workspace (hoisted)**

Run (repo root): `pnpm install`
Expected: completes; `react-native-svg` and the font package appear in the hoisted `node_modules`.

- [ ] **Step 3: Confirm the mobile app still typechecks**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors (nothing uses the new deps yet; this confirms the install didn't break types).

- [ ] **Step 4: Confirm versions resolved (sanity)**

Run: `node -e "const p=require('./apps/mobile/package.json').dependencies; console.log('svg',p['react-native-svg'],'font',p['expo-font'],'noto',p['@expo-google-fonts/noto-sans-symbols'])"`
Expected: prints three non-empty version strings (e.g. `svg 15.x font ~13.x noto 0.4.1`).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): add react-native-svg + Noto Sans Symbols glyph font"
```

---

## Task 2: Chart palette + constants module

**Files:** Create `apps/mobile/components/chart/palette.ts`

- [ ] **Step 1: Write `palette.ts`**

```ts
import { NIGHT } from "@astro/engine";

/** Dark ("Celestial Midnight") palette — reused from the engine. Light/Auto is a later slice. */
export const C = NIGHT;

/** Bundled symbols-font family carrying the planet glyphs (☉☽☿…). Must match the
 *  key passed to useFonts() in App.tsx and the @expo-google-fonts export name. */
export const GLYPH_FONT = "NotoSansSymbols_400Regular";

/** Chart drawing constants — single source, no magic numbers in the SVG layers.
 *  Values mirror the web Dial/NatalLayer (stroke widths, opacities, sizes). */
export const CHART = {
  ringStroke: 1.5,
  ringOpacity: 0.6,
  liveRingOpacity: 0.32,
  tickStroke: 1,
  tickOpacity: 0.42,
  boundStroke: 1.5,
  boundOpacity: 0.55,
  signFontSize: 17,
  signLetterSpacing: 2.5,
  signSpan: 28,
  natalGlyphSize: 22,
  natalTokenR: 16,
  natalTickStroke: 1.5,
  natalTickOpacity: 0.4,
} as const;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors (`NIGHT` is exported from `@astro/engine`).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/chart/palette.ts
git commit -m "feat(mobile): chart palette + drawing constants"
```

---

## Task 3: Dial (rings, ticks, boundaries, sign labels)

**Files:** Create `apps/mobile/components/chart/Dial.tsx`

This is the RN port of `apps/web/components/Chart/Dial.tsx`. `curvedLabels` defaults to `true`
(curved `TextPath`, matching web). The horizontal fallback (`curvedLabels={false}`) exists for
the case where Android's `TextPath` misrenders — flip the prop in `App.tsx` after the device check.

- [ ] **Step 1: Write `Dial.tsx`**

```tsx
import { memo } from "react";
import type { ReactElement } from "react";
import { G, Circle, Line, Path, Text as SvgText, TextPath, Defs } from "react-native-svg";
import { R, CX, CY, polar, arcPath, SIGNS } from "@astro/engine";
import { C, CHART } from "./palette";

// Round to 2 decimals to keep path strings short and stable.
const q = (n: number) => Math.round(n * 100) / 100;

// Curved sign label arc: top-half labels ride left-to-right; bottom-half flip the sweep so
// the text stays upright (mirrors the web signArc / prototype buildDial).
function signArc(s: number): string {
  const lonC = s * 30 + 15;
  const [, ly] = polar(R.signLabel, lonC);
  const span = CHART.signSpan;
  return ly < CY
    ? arcPath(R.signLabel, lonC + span / 2, lonC - span / 2, 1)
    : arcPath(R.signLabel, lonC - span / 2, lonC + span / 2, 0);
}

interface Props {
  curvedLabels?: boolean;
}

function DialBase({ curvedLabels = true }: Props) {
  const ticks: ReactElement[] = [];
  for (let t = 0; t < 360; t += 5) {
    if (t % 30 === 0) continue; // sign boundaries drawn separately
    const [x1, y1] = polar(R.signInner, t);
    const [x2, y2] = polar(R.signInner - 8, t);
    ticks.push(
      <Line
        key={`t${t}`}
        x1={q(x1)} y1={q(y1)} x2={q(x2)} y2={q(y2)}
        stroke={C.line} strokeWidth={CHART.tickStroke} opacity={CHART.tickOpacity}
      />,
    );
  }

  const defs: ReactElement[] = [];
  const bounds: ReactElement[] = [];
  const labels: ReactElement[] = [];
  for (let s = 0; s < 12; s++) {
    const [ox, oy] = polar(R.outer, s * 30);
    const [ix, iy] = polar(R.signInner, s * 30);
    bounds.push(
      <Line
        key={`b${s}`}
        x1={q(ix)} y1={q(iy)} x2={q(ox)} y2={q(oy)}
        stroke={C.line} strokeWidth={CHART.boundStroke} opacity={CHART.boundOpacity}
      />,
    );

    const label = SIGNS[s].toUpperCase();
    if (curvedLabels) {
      const id = `acSignArc${s}`;
      defs.push(<Path key={`p${s}`} id={id} d={signArc(s)} fill="none" stroke="none" />);
      labels.push(
        <SvgText
          key={`l${s}`}
          fill={C.sign}
          fontSize={CHART.signFontSize}
          letterSpacing={CHART.signLetterSpacing}
          textAnchor="middle"
        >
          <TextPath href={`#${id}`} startOffset="50%">{label}</TextPath>
        </SvgText>,
      );
    } else {
      // Horizontal fallback: upright label at the sign's mid-angle. Reliable on every
      // platform; used only if curved TextPath renders poorly on the device.
      const lonC = s * 30 + 15;
      const [lx, ly] = polar(R.signLabel, lonC);
      labels.push(
        <SvgText
          key={`l${s}`}
          x={q(lx)} y={q(ly)}
          fill={C.sign}
          fontSize={CHART.signFontSize}
          textAnchor="middle"
          dy={CHART.signFontSize * 0.35}
        >
          {label}
        </SvgText>,
      );
    }
  }

  return (
    <G>
      <Defs>{defs}</Defs>
      <Circle cx={CX} cy={CY} r={R.outer} fill="none" stroke={C.line} strokeWidth={CHART.ringStroke} opacity={CHART.ringOpacity} />
      <Circle cx={CX} cy={CY} r={R.signInner} fill="none" stroke={C.line} strokeWidth={CHART.ringStroke} opacity={CHART.ringOpacity} />
      <Circle cx={CX} cy={CY} r={R.liveRing} fill="none" stroke={C.line} strokeWidth={CHART.tickStroke} opacity={CHART.liveRingOpacity} />
      {ticks}
      {bounds}
      {labels}
    </G>
  );
}

/** The zodiac ring: rings, minor ticks, sign boundaries, sign labels. Static. */
export const Dial = memo(DialBase);
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors. If `letterSpacing` reports a type error on `<SvgText>`, remove that one prop (it is a refinement, not required) and re-run — the plan's web render will confirm spacing visually.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/chart/Dial.tsx
git commit -m "feat(mobile): Dial — rings, ticks, sign labels (react-native-svg)"
```

---

## Task 4: AspectLayer (aspect lines)

**Files:** Create `apps/mobile/components/chart/AspectLayer.tsx`

RN port of `apps/web/components/Chart/AspectLayer.tsx`, stripped of the per-planet visibility
and theme-`t` props (static dark wheel: all major+minor shown, `aspectColor(def, 0)`).

- [ ] **Step 1: Write `AspectLayer.tsx`**

```tsx
import { memo } from "react";
import type { ReactElement } from "react";
import { G, Line } from "react-native-svg";
import { R, polar, aspectBetween, aspectColor, PLANET_KEYS } from "@astro/engine";
import type { Positions } from "@astro/engine";

interface Props {
  positions: Positions;
  showMajor?: boolean;
  showMinor?: boolean;
}

// One line between every pair of natal planets that forms an aspect, colored for the dark
// theme (aspectColor(def, 0)), filtered by the major/minor toggles (mirrors web drawAspects).
function AspectLayerBase({ positions, showMajor = true, showMinor = true }: Props) {
  const lines: ReactElement[] = [];
  for (let i = 0; i < PLANET_KEYS.length; i++) {
    for (let j = i + 1; j < PLANET_KEYS.length; j++) {
      const a = PLANET_KEYS[i];
      const b = PLANET_KEYS[j];
      const def = aspectBetween(positions[a], positions[b]);
      if (!def) continue;
      if (def.tier === "major" && !showMajor) continue;
      if (def.tier === "minor" && !showMinor) continue;
      const [x1, y1] = polar(R.aspect, positions[a]);
      const [x2, y2] = polar(R.aspect, positions[b]);
      lines.push(
        <Line
          key={`${a}-${b}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={aspectColor(def, 0)}
          strokeWidth={def.width}
          opacity={def.opacity}
          strokeDasharray={def.dash || undefined}
        />,
      );
    }
  }
  return <G>{lines}</G>;
}

export const AspectLayer = memo(AspectLayerBase);
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/chart/AspectLayer.tsx
git commit -m "feat(mobile): AspectLayer — natal aspect lines (react-native-svg)"
```

---

## Task 5: NatalLayer (planet glyphs)

**Files:** Create `apps/mobile/components/chart/NatalLayer.tsx`

RN port of `apps/web/components/Chart/NatalLayer.tsx`, stripped of hover/visibility/mode (static).
Glyphs render in `GLYPH_FONT`; vertical centering via `dy` (RN svg has no reliable
`dominantBaseline` on Android).

- [ ] **Step 1: Write `NatalLayer.tsx`**

```tsx
import { memo } from "react";
import type { ReactElement } from "react";
import { G, Line, Circle, Text as SvgText } from "react-native-svg";
import { R, polar, declutter, PLANET_KEYS, PLANET_GLYPH } from "@astro/engine";
import type { Positions } from "@astro/engine";
import { C, CHART, GLYPH_FONT } from "./palette";

interface Props {
  positions: Positions;
}

// Fixed birth glyphs on the inner ring, fanned out so a stellium doesn't overlap (declutter),
// each with a leader tick back to its true longitude and a bordered token (mirrors web NatalLayer).
function NatalLayerBase({ positions }: Props) {
  const disp = declutter(positions);
  const nodes: ReactElement[] = PLANET_KEYS.map((key) => {
    const [tx, ty] = polar(R.signInner, positions[key]);
    const [gx, gy] = polar(R.natalGlyph, disp[key]);
    return (
      <G key={key}>
        <Line x1={tx} y1={ty} x2={gx} y2={gy} stroke={C.natal} strokeWidth={CHART.natalTickStroke} opacity={CHART.natalTickOpacity} />
        <Circle cx={gx} cy={gy} r={CHART.natalTokenR} fill={C.bg} stroke={C.natal} strokeWidth={1.5} />
        <SvgText
          x={gx} y={gy}
          fill={C.natal}
          fontFamily={GLYPH_FONT}
          fontSize={CHART.natalGlyphSize}
          textAnchor="middle"
          dy={CHART.natalGlyphSize * 0.35}
        >
          {PLANET_GLYPH[key]}
        </SvgText>
      </G>
    );
  });
  return <G>{nodes}</G>;
}

export const NatalLayer = memo(NatalLayerBase);
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/chart/NatalLayer.tsx
git commit -m "feat(mobile): NatalLayer — planet glyphs (react-native-svg)"
```

---

## Task 6: ChartWheel (compose into one responsive Svg)

**Files:** Create `apps/mobile/components/chart/ChartWheel.tsx`

- [ ] **Step 1: Write `ChartWheel.tsx`**

```tsx
import { memo } from "react";
import { useWindowDimensions, View } from "react-native";
import Svg from "react-native-svg";
import type { Positions } from "@astro/engine";
import { Dial } from "./Dial";
import { AspectLayer } from "./AspectLayer";
import { NatalLayer } from "./NatalLayer";

interface Props {
  positions: Positions;
  curvedLabels?: boolean;
}

// One square <Svg> sized to the screen. Z-order: aspect lines under the dial, glyphs on top.
function ChartWheelBase({ positions, curvedLabels = true }: Props) {
  const { width, height } = useWindowDimensions();
  const size = Math.max(0, Math.min(width, height) - 24);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 1000 1000">
        <AspectLayer positions={positions} />
        <Dial curvedLabels={curvedLabels} />
        <NatalLayer positions={positions} />
      </Svg>
    </View>
  );
}

export const ChartWheel = memo(ChartWheelBase);
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/chart/ChartWheel.tsx
git commit -m "feat(mobile): ChartWheel — compose layers into a responsive Svg"
```

---

## Task 7: Wire the screen (font gate + ChartWheel)

**Files:** Modify `apps/mobile/App.tsx`

- [ ] **Step 1: Replace `App.tsx`**

```tsx
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { useFonts, NotoSansSymbols_400Regular } from "@expo-google-fonts/noto-sans-symbols";
import { DEFAULT_BIRTH, birthInstant, positions, NIGHT } from "@astro/engine";
import { ChartWheel } from "./components/chart/ChartWheel";

export default function App() {
  // Gate on the glyph font: rendering planet glyphs before it loads would flash tofu.
  const [fontsLoaded] = useFonts({ NotoSansSymbols_400Regular });
  const np = positions(birthInstant(DEFAULT_BIRTH));

  return (
    <View style={styles.root}>
      <Text style={styles.brand}>MoveStar</Text>
      {fontsLoaded ? <ChartWheel positions={np} /> : <Text style={styles.note}>loading…</Text>}
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT.bg, alignItems: "center", justifyContent: "center", gap: 16, padding: 12 },
  brand: { color: NIGHT.text, fontSize: 28, letterSpacing: 5, fontWeight: "600" },
  note: { color: NIGHT.textDim, fontSize: 13, letterSpacing: 2 },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: no errors. (`useFonts` and `NotoSansSymbols_400Regular` are exported by
`@expo-google-fonts/noto-sans-symbols`; `NIGHT` by `@astro/engine`.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): render the natal ChartWheel behind the font gate"
```

---

## Task 8: Verify — Android bundle + web-target screenshot

**Files:** none (verification)

- [ ] **Step 1: Bundle for Android (toolchain proof)**

Run (in `apps/mobile/`):
```bash
npx expo export --platform android --output-dir /tmp/movestar-chart-bundle
```
Expected: completes, no "Unable to resolve module `react-native-svg`" / `@astro/engine` /
`@expo-google-fonts/noto-sans-symbols`. Proves Metro resolves the new deps and the wheel
compiles for Android.

- [ ] **Step 2: Start the web target (background)**

Run (in `apps/mobile/`, background): `pnpm web`
Wait until it prints a local URL (typically `http://localhost:8081`). `react-native-svg`
renders to DOM SVG under `react-native-web`, so the wheel is visible in a browser.

- [ ] **Step 3: Screenshot the wheel with the /browse skill and verify**

Open the printed URL with the `/browse` skill and screenshot it. Confirm the visual checklist:
  - Two concentric outer rings + a faint inner ring.
  - 12 sign boundary spokes and minor degree ticks.
  - 12 sign labels reading around the ring (curved).
  - **All 10 planet glyphs visible as real symbols** (☉☽☿♀♂♃♄♅♆♇), each in a bordered token — **none showing as `□` (tofu)**.
  - Colored aspect lines crossing the interior.
Stop the web server after.

- [ ] **Step 4: Resolve any visual issues found (concrete fixes, not placeholders)**
  - **Any glyph is `□` (tofu):** the font lacks it. Switch the dep + import to
    `@expo-google-fonts/noto-sans-symbols-2` (set `GLYPH_FONT = "NotoSansSymbols2_400Regular"`
    in `palette.ts`, update the import + `useFonts` key in `App.tsx`), re-run Steps 2–3. If a
    glyph is still missing, replace just that glyph with an inline SVG `<Path>` in `NatalLayer`.
  - **Glyphs/labels vertically off-center:** adjust the `dy` multiplier (try `0.32`–`0.38`).
  - **Curved labels overlap or render broken:** set `curvedLabels={false}` on `<ChartWheel>` in
    `App.tsx` (horizontal fallback), re-verify.
  Commit any fix with `git commit -m "fix(mobile): <what> in chart wheel"`.

- [ ] **Step 5: No commit if nothing changed (verification only).** Record the screenshot result in the completion report.

---

## Task 9: Device-run hand-off (user verification)

**Files:** none

- [ ] **Step 1: Present these steps to the user**

> **See the chart wheel on your phone (Expo Go):**
> 1. Phone + computer on the **same Wi-Fi**.
> 2. In a terminal: `cd ~/dev/astro-clock/apps/mobile && pnpm start`. A **QR code** appears.
> 3. **Android:** Expo Go → "Scan QR code". **iPhone:** Camera app → point at the QR → tap the banner.
> 4. You should see **MoveStar** and, below it, the **natal chart wheel** — rings, the 12 signs,
>    the 10 planet symbols in little circles, and colored aspect lines.
> 5. **Check the planet symbols are real glyphs, not empty boxes (□).** If any are boxes, tell me
>    (I'll switch the symbols font).
> 6. If the sign labels look broken/overlapping, tell me (I'll flip to the straight-label layout).
> 7. QR won't connect on locked-down Wi-Fi? Stop it and run `pnpm start --tunnel`, scan the new QR.

- [ ] **Step 2: Stop and wait for the user to confirm the wheel renders with real glyphs on their device.**
  - Tofu glyphs reported → apply Task 8 Step 4 font switch, commit, ask them to reload (`r` in the terminal).
  - Broken labels reported → set `curvedLabels={false}` in `App.tsx`, commit, reload.

---

## Self-Review

- **Spec coverage:**
  - §1 goal (natal wheel, sample birth, replaces text screen) → Tasks 3–7.
  - §2 renderer `react-native-svg` → Task 1 install; Tasks 3–6 use its primitives.
  - §2 glyph font (Noto Sans Symbols via expo-font, verify 10, fallback) → Task 1 install, Task 5 render, Task 7 gate, Task 8 Step 4 + Task 9 verify/fallback.
  - §2 sign labels curved + straight fallback → Task 3 (`curvedLabels` prop, both paths coded).
  - §2 colors from `NIGHT`/`aspectColor` → Task 2 palette, Tasks 3–5 consume it.
  - §3.2 engine reuse table → every layer imports the listed helpers; no re-derivation.
  - §3.3 components (`palette`, `Dial`, `NatalLayer`, `AspectLayer`, `ChartWheel`) → Tasks 2–6.
  - §3.4 font gate in `App.tsx` → Task 7.
  - §4 deps → Task 1.
  - §5 verification (typecheck, Android export, web screenshot, device) → typecheck in every task; Task 8 Steps 1–3; Task 9.
  - §6 risks (font glyph, TextPath, version drift, baseline) → Task 1 (expo install), Task 3 (fallback path), Task 5 (`dy`), Task 8 Step 4 fixes.
  - §7 out-of-scope items appear in no task. ✓
- **Placeholder scan:** none. Every code step shows complete code; the only conditional steps (Task 8 Step 4, Task 9 Step 2) contain concrete fixes keyed to concrete observations, not "TODO".
- **Type/name consistency:** `GLYPH_FONT` defined in `palette.ts` (Task 2) and used in `NatalLayer` (Task 5); its value `"NotoSansSymbols_400Regular"` matches the `useFonts` key + import in `App.tsx` (Task 7). `C`/`CHART` defined Task 2, consumed Tasks 3 & 5. `ChartWheel` prop `positions: Positions` (Task 6) matches `App.tsx` usage (Task 7) and the engine `positions()` return. `curvedLabels` prop threads `App → ChartWheel → Dial` consistently. `Dial`/`AspectLayer`/`NatalLayer` named exports match `ChartWheel`'s imports. `aspectColor(def, 0)` / `aspectBetween` / `declutter` / `polar` / `arcPath` / `R` / `SIGNS` / `PLANET_KEYS` / `PLANET_GLYPH` all match the verified engine signatures above.
