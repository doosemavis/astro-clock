# Mobile Live Coordinates Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Pro, mobile-only left slide-out panel with two live columns (Fixed = natal layer, Moveable = live layer), each listing all 10 chart glyphs with sign+degree, Decan, Cusp, and Anaretic — reading the same positions the wheel draws.

**Architecture:** Three pure functions in `@astro/engine` (`decanOf`/`cuspOf`/`isAnaretic`) computed from a longitude; a pure mobile mapper (`buildCoordinateRows`) turning a `Positions` into row data; React Native view components (`CoordinateRow`/`CoordinateColumn`/`CoordinatesPanel`) fed the existing `natalPos`/`livePos`; a round `CoordinatesButton` (mirrors `Avatar`) wired into `App.tsx` on the left, Pro-gated with paywall-on-tap.

**Tech Stack:** TypeScript, `@astro/engine` (workspace), Expo/React Native, `react-native-svg`, node `--test` (`--experimental-strip-types`).

**Spec:** `docs/superpowers/specs/2026-06-06-mobile-coordinates-panel-design.md`

---

### Task 1: Engine — `decanOf`, `cuspOf`, `isAnaretic`

**Files:**
- Create: `packages/engine/src/coordinates.ts`
- Create: `packages/engine/src/coordinates.test.ts`
- Modify: `packages/engine/src/index.ts` (add one export line)

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/coordinates.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { decanOf, cuspOf, isAnaretic } from "./coordinates.ts";

// Aries 0-9.99 = 1st decan, ruler Mars; 10-19.99 = 2nd, Sun; 20-29.99 = 3rd, Venus.
test("decanOf: Aries decans + Hellenistic-face rulers", () => {
  assert.deepEqual(decanOf(0), { decan: 1, ruler: "mars" });
  assert.deepEqual(decanOf(9.99), { decan: 1, ruler: "mars" });
  assert.deepEqual(decanOf(10), { decan: 2, ruler: "sun" });
  assert.deepEqual(decanOf(20), { decan: 3, ruler: "venus" });
});

test("decanOf: face cycle continues across signs", () => {
  // Taurus (30-60): 1st=Mercury, 2nd=Moon, 3rd=Saturn
  assert.deepEqual(decanOf(30), { decan: 1, ruler: "mercury" });
  assert.deepEqual(decanOf(40), { decan: 2, ruler: "moon" });
  assert.deepEqual(decanOf(50), { decan: 3, ruler: "saturn" });
  // Gemini 1st (60-70) = Jupiter, then the 7-cycle wraps: Gemini 2nd = Mars
  assert.deepEqual(decanOf(60), { decan: 1, ruler: "jupiter" });
  assert.deepEqual(decanOf(70), { decan: 2, ruler: "mars" });
});

test("decanOf: normalizes out-of-range longitudes", () => {
  assert.deepEqual(decanOf(360), { decan: 1, ruler: "mars" }); // == 0
  assert.deepEqual(decanOf(-350), { decan: 2, ruler: "sun" }); // == 10
});

test("cuspOf: within 1deg of a sign boundary", () => {
  assert.deepEqual(cuspOf(0.5), { onCusp: true, from: "Pisces", to: "Aries" });   // start of Aries
  assert.deepEqual(cuspOf(29.5), { onCusp: true, from: "Aries", to: "Taurus" });  // end of Aries
  assert.equal(cuspOf(15), null);                                                 // mid-sign
  assert.equal(cuspOf(0, 0), null);                                               // orb 0, exactly at boundary not counted
});

test("isAnaretic: only the final degree", () => {
  assert.equal(isAnaretic(29), true);
  assert.equal(isAnaretic(29.99), true);
  assert.equal(isAnaretic(30), false);   // == Taurus 0
  assert.equal(isAnaretic(28.99), false);
  assert.equal(isAnaretic(59.5), true);  // Taurus 29.5
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/engine && node --test --experimental-strip-types "src/coordinates.test.ts"`
Expected: FAIL — `Cannot find module './coordinates.ts'`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/engine/src/coordinates.ts`:

```ts
// Pure degree-based astrology readouts derived from an ecliptic longitude (0..360).
// Same source of truth as the wheel, so panel readouts match the chart by construction.
import { SIGNS, type PlanetKey, type Sign } from "./types.ts";
import { signOf, degInSign } from "./chart.ts";

const norm = (lon: number): number => ((lon % 360) + 360) % 360;

// Hellenistic "faces" / Chaldean decans: a 7-planet cycle beginning at Aries 1st decan = Mars.
const FACE_ORDER: PlanetKey[] = ["mars", "sun", "venus", "mercury", "moon", "saturn", "jupiter"];

/** Which 10-degree decan of the sign (1/2/3) and its Hellenistic-face ruler. */
export function decanOf(lon: number): { decan: 1 | 2 | 3; ruler: PlanetKey } {
  const d = norm(lon);
  const decan = (Math.floor(degInSign(d) / 10) + 1) as 1 | 2 | 3;
  const ruler = FACE_ORDER[Math.floor(d / 10) % 7];
  return { decan, ruler };
}

/** On-cusp info when within `orbDeg` of a sign boundary, else null. */
export function cuspOf(
  lon: number,
  orbDeg = 1,
): { onCusp: boolean; from: Sign; to: Sign } | null {
  const d = degInSign(lon);
  const sign = signOf(lon) as Sign;
  const idx = SIGNS.indexOf(sign);
  if (d < orbDeg) return { onCusp: true, from: SIGNS[(idx + 11) % 12], to: sign };
  if (d > 30 - orbDeg) return { onCusp: true, from: sign, to: SIGNS[(idx + 1) % 12] };
  return null;
}

/** True when the body is in the final (anaretic) degree, [29, 30). */
export function isAnaretic(lon: number): boolean {
  const d = degInSign(lon);
  return d >= 29 && d < 30;
}
```

> Note: this assumes `SIGNS` and `Sign`/`PlanetKey` are exported from `./types.ts`, and `signOf`/`degInSign` from `./chart.ts` (both confirmed present). If `degInSign` already normalizes internally (it does — `rev(lon) % 30`), passing the un-normalized `lon` to it in `cuspOf`/`isAnaretic` is safe.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/engine && node --test --experimental-strip-types "src/coordinates.test.ts"`
Expected: PASS — all 5 tests.

- [ ] **Step 5: Export from the engine index**

Modify `packages/engine/src/index.ts` — add after the existing `aspects.ts` export line:

```ts
export { decanOf, cuspOf, isAnaretic } from "./coordinates.ts";
```

- [ ] **Step 6: Typecheck + commit**

Run: `cd packages/engine && npx tsc --noEmit` → Expected: no errors.

```bash
git add packages/engine/src/coordinates.ts packages/engine/src/coordinates.test.ts packages/engine/src/index.ts
git commit -m "feat(engine): decanOf/cuspOf/isAnaretic for the coordinates panel"
```

---

### Task 2: Mobile row mapper — `buildCoordinateRows`

Turns a `Positions` into display-ready rows. Pure + unit-tested under the strip-types runner.

**Files:**
- Create: `apps/mobile/lib/coordinateRows.ts`
- Create: `apps/mobile/lib/coordinateRows.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/coordinateRows.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCoordinateRows } from "./coordinateRows.ts";
import { PLANET_KEYS } from "@astro/engine";
import type { Positions } from "@astro/engine";

// Minimal positions: all bodies at 0 except a couple we assert on.
function pos(overrides: Partial<Positions>): Positions {
  const base = Object.fromEntries(PLANET_KEYS.map((k) => [k, 0])) as Positions;
  return { ...base, ...overrides };
}

test("buildCoordinateRows: one row per planet, in PLANET_KEYS order", () => {
  const rows = buildCoordinateRows(pos({}));
  assert.equal(rows.length, PLANET_KEYS.length);
  assert.deepEqual(rows.map((r) => r.key), PLANET_KEYS);
});

test("buildCoordinateRows: derives sign, degree, decan, anaretic, cusp", () => {
  // sun at Pisces 0deg29' = 330 + 29/60 ; moon at Aries 29.5 (anaretic + cusp to Taurus)
  const rows = buildCoordinateRows(pos({ sun: 330 + 29 / 60, moon: 29.5 }));
  const sun = rows.find((r) => r.key === "sun")!;
  assert.equal(sun.sign, "Pisces");
  assert.equal(sun.dms, "0°29'");
  assert.equal(sun.decan, 1);
  assert.equal(sun.anaretic, false);

  const moon = rows.find((r) => r.key === "moon")!;
  assert.equal(moon.sign, "Aries");
  assert.equal(moon.dms, "29°30'");
  assert.equal(moon.decan, 3);
  assert.equal(moon.anaretic, true);
  assert.equal(moon.cusp?.to, "Taurus");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && node --test --experimental-strip-types "lib/coordinateRows.test.ts"`
Expected: FAIL — `Cannot find module './coordinateRows.ts'`.

> If the import of `@astro/engine` fails to resolve under the strip-types runner (workspace alias), match the import style already used by other passing `apps/mobile/lib/*.test.ts` files — check one before writing (e.g. they may import from a relative `../../packages/engine/src/index.ts`). Use whatever the existing mobile tests use.

- [ ] **Step 3: Write minimal implementation**

Create `apps/mobile/lib/coordinateRows.ts`:

```ts
import {
  PLANET_KEYS, PLANET_GLYPH, SIGN_GLYPH, signOf, degInSign, decanOf, cuspOf, isAnaretic,
} from "@astro/engine";
import type { Positions, PlanetKey, Sign } from "@astro/engine";

export interface CoordinateRow {
  key: PlanetKey;
  glyph: string;          // planet glyph
  sign: Sign;
  signGlyph: string;
  dms: string;            // degree within sign, e.g. "0°29'"
  decan: 1 | 2 | 3;
  decanRuler: PlanetKey;
  decanRulerGlyph: string;
  anaretic: boolean;
  cusp: { from: Sign; to: Sign } | null;
}

/** Format the degree-within-sign as D°MM' (e.g. 0.4833 -> "0°29'"). */
function fmtDeg(lon: number): string {
  const dis = degInSign(lon);
  const deg = Math.floor(dis);
  const min = Math.floor((dis - deg) * 60);
  return `${deg}°${String(min).padStart(2, "0")}'`;
}

/** Display rows for every chart glyph (the 10 planets) from a Positions snapshot. */
export function buildCoordinateRows(positions: Positions): CoordinateRow[] {
  return PLANET_KEYS.map((key) => {
    const lon = positions[key];
    const sign = signOf(lon) as Sign;
    const { decan, ruler } = decanOf(lon);
    const cuspHit = cuspOf(lon);
    return {
      key,
      glyph: PLANET_GLYPH[key],
      sign,
      signGlyph: SIGN_GLYPH[sign],
      dms: fmtDeg(lon),
      decan,
      decanRuler: ruler,
      decanRulerGlyph: PLANET_GLYPH[ruler],
      anaretic: isAnaretic(lon),
      cusp: cuspHit ? { from: cuspHit.from, to: cuspHit.to } : null,
    };
  });
}
```

> The `moon: 29.5` test row expects `dms === "29°30'"`: `degInSign(29.5)=29.5` → deg 29, min `floor(0.5*60)=30` → `"29°30'"`. The `sun: 330+29/60` row: `degInSign = 0.4833…` → deg 0, min `floor(0.4833*60)=floor(29.0)=29` → `"0°29'"`. If floating error makes `29/60*60` land on `28`, bump the test input to `330 + 29.5/60` rather than weakening the assertion.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && node --test --experimental-strip-types "lib/coordinateRows.test.ts"`
Expected: PASS — both tests.

- [ ] **Step 5: Typecheck + commit**

Run: `cd apps/mobile && npm run typecheck` → Expected: no errors.

```bash
git add apps/mobile/lib/coordinateRows.ts apps/mobile/lib/coordinateRows.test.ts
git commit -m "feat(mobile): buildCoordinateRows mapper for the coordinates panel"
```

---

### Task 3: `CoordinateRow` + `CoordinateColumn` components

**Files:**
- Create: `apps/mobile/components/coordinates/CoordinateRow.tsx`
- Create: `apps/mobile/components/coordinates/CoordinateColumn.tsx`

> Before writing, open `apps/mobile/components/Avatar.tsx` and one existing styled component to confirm the exact import paths/names for the theme hook (`useTheme`), the `Palette` type, `GLYPH_FONT`, and `textGlyph`. The paths below match Avatar.tsx as of this plan; adjust if they differ.

- [ ] **Step 1: Create `CoordinateRow.tsx`**

```tsx
import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { GLYPH_FONT } from "../chart/palette";
import { textGlyph } from "../../lib/glyph";
import type { CoordinateRow as Row } from "../../lib/coordinateRows";

/** One body's readout: glyph + sign/degree + decan, with anaretic/cusp badges. */
export const CoordinateRow = memo(function CoordinateRow({ row }: { row: Row }) {
  const { palette: p } = useTheme();
  const s = makeStyles(p);
  return (
    <View style={s.row}>
      <Text style={s.glyph}>{textGlyph(row.glyph)}</Text>
      <View style={s.body}>
        <Text style={s.pos}>
          <Text style={s.sign}>{textGlyph(row.signGlyph)}</Text> {row.dms}
        </Text>
        <Text style={s.decan}>
          {row.decan === 1 ? "1st" : row.decan === 2 ? "2nd" : "3rd"} ·{" "}
          <Text style={s.sign}>{textGlyph(row.decanRulerGlyph)}</Text>
        </Text>
      </View>
      <View style={s.badges}>
        {row.anaretic ? <Text style={[s.badge, s.anaretic]}>29°</Text> : null}
        {row.cusp ? <Text style={[s.badge, s.cusp]}>cusp</Text> : null}
      </View>
    </View>
  );
});

const makeStyles = (p: Palette) => StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  glyph: { color: p.text, fontFamily: GLYPH_FONT, fontSize: 18, width: 22, textAlign: "center" },
  body: { flex: 1 },
  pos: { color: p.text, fontSize: 14, fontWeight: "600" },
  sign: { fontFamily: GLYPH_FONT },
  decan: { color: p.textDim, fontSize: 12, marginTop: 1 },
  badges: { flexDirection: "row", gap: 4 },
  badge: { fontSize: 10, fontWeight: "800", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, overflow: "hidden" },
  anaretic: { color: p.bg, backgroundColor: p.live },
  cusp: { color: p.live, borderWidth: 1, borderColor: p.border },
});
```

> If `Palette` is not exported from `@astro/engine`, import it from wherever `useTheme` lives (e.g. `../../lib/theme`). Use the palette keys that actually exist (`p.text`, `p.textDim`, `p.bg`, `p.live`, `p.border`, `p.panel`) — confirm names against `lib/theme` and drop any that don't exist, substituting the closest equivalent.

- [ ] **Step 2: Create `CoordinateColumn.tsx`**

```tsx
import { View, Text, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { CoordinateRow } from "./CoordinateRow";
import type { CoordinateRow as Row } from "../../lib/coordinateRows";

interface Props { title: string; rows: Row[] | null; emptyHint?: string; }

/** One titled column (Fixed or Moveable). `rows === null` => empty placeholder. */
export function CoordinateColumn({ title, rows, emptyHint }: Props) {
  const { palette: p } = useTheme();
  const s = makeStyles(p);
  return (
    <View style={s.col}>
      <Text style={s.title}>{title}</Text>
      {rows === null ? (
        <Text style={s.empty}>{emptyHint ?? "No data"}</Text>
      ) : (
        rows.map((r) => <CoordinateRow key={r.key} row={r} />)
      )}
    </View>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  col: { flex: 1 },
  title: { color: p.textDim, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  empty: { color: p.textDim, fontSize: 13, fontStyle: "italic", marginTop: 8 },
});
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd apps/mobile && npm run typecheck` → Expected: no errors.

```bash
git add apps/mobile/components/coordinates/CoordinateRow.tsx apps/mobile/components/coordinates/CoordinateColumn.tsx
git commit -m "feat(mobile): CoordinateRow + CoordinateColumn components"
```

---

### Task 4: `CoordinatesPanel` (left slide-out, two columns, switch stub)

**Files:**
- Create: `apps/mobile/components/coordinates/CoordinatesPanel.tsx`

- [ ] **Step 1: Create `CoordinatesPanel.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, ScrollView, View, Text, StyleSheet, Dimensions } from "react-native";
import type { Palette } from "@astro/engine";
import type { Positions } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { buildCoordinateRows } from "../../lib/coordinateRows";
import { CoordinateColumn } from "./CoordinateColumn";

interface Props {
  visible: boolean;
  onClose: () => void;
  natalPos: Positions | null;   // null when no birth chart is set
  livePos: Positions;
}

const PANEL_W = Math.min(Dimensions.get("window").width * 0.86, 380);

/** Left slide-out panel: Fixed (natal) | Moveable (live) coordinate columns. The header
 *  carries a view-switch stub (Coordinates / Staircase) — Staircase is disabled until v2. */
export function CoordinatesPanel({ visible, onClose, natalPos, livePos }: Props) {
  const { palette: p } = useTheme();
  const s = makeStyles(p);
  const x = useRef(new Animated.Value(-PANEL_W)).current;

  useEffect(() => {
    Animated.timing(x, { toValue: visible ? 0 : -PANEL_W, duration: 200, useNativeDriver: true }).start();
  }, [visible, x]);

  const fixed = natalPos ? buildCoordinateRows(natalPos) : null;
  const moveable = buildCoordinateRows(livePos);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <Animated.View style={[s.panel, { transform: [{ translateX: x }] }]}>
        <View style={s.header}>
          <Text style={s.tabActive}>Coordinates</Text>
          <Text style={s.tabDisabled}>Staircase</Text>
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.columns}>
            <CoordinateColumn title="Fixed" rows={fixed} emptyHint="Set your birth details" />
            <View style={s.divider} />
            <CoordinateColumn title="Moveable" rows={moveable} />
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  panel: {
    position: "absolute", top: 0, bottom: 0, left: 0, width: PANEL_W,
    backgroundColor: p.panel, borderRightWidth: 1, borderRightColor: p.border, paddingTop: 56,
  },
  header: { flexDirection: "row", gap: 16, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: p.border },
  tabActive: { color: p.text, fontSize: 16, fontWeight: "800" },
  tabDisabled: { color: p.textDim, fontSize: 16, fontWeight: "600", opacity: 0.5 },
  scroll: { padding: 16 },
  columns: { flexDirection: "row" },
  divider: { width: 1, backgroundColor: p.border, marginHorizontal: 12 },
});
```

- [ ] **Step 2: Typecheck + commit**

Run: `cd apps/mobile && npm run typecheck` → Expected: no errors.

```bash
git add apps/mobile/components/coordinates/CoordinatesPanel.tsx
git commit -m "feat(mobile): CoordinatesPanel left slide-out with Fixed/Moveable columns"
```

---

### Task 5: `CoordinatesButton` + wire into `App.tsx` (Pro-gated)

**Files:**
- Create: `apps/mobile/components/CoordinatesButton.tsx`
- Modify: `apps/mobile/App.tsx`

- [ ] **Step 1: Create `CoordinatesButton.tsx`**

```tsx
import { memo } from "react";
import { Pressable } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../lib/theme";

interface Props { onPress: () => void; size?: number; }

/** Round button mirroring the Avatar; a small list icon opens the coordinates panel. */
export const CoordinatesButton = memo(function CoordinatesButton({ onPress, size = 42 }: Props) {
  const { palette: p } = useTheme();
  const r = size / 2;
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Svg width={size} height={size}>
        <Circle cx={r} cy={r} r={r - 1} fill={p.panel} stroke={p.live} strokeWidth={1.5} />
        {/* simple "list" mark */}
        <Path d={`M${r - 8} ${r - 6} H${r + 8} M${r - 8} ${r} H${r + 8} M${r - 8} ${r + 6} H${r + 8}`}
          stroke={p.live} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    </Pressable>
  );
});
```

> Mirror Avatar.tsx exactly for the circle (`fill={p.panel} stroke={p.live} strokeWidth={1.5}`, `r={r-1}`, default `size=42`) so the two round buttons match visually.

- [ ] **Step 2: Wire state + imports into `App.tsx`**

Add imports near the other component imports (after the `HeaderMenu` import line):

```tsx
import { CoordinatesButton } from "./components/CoordinatesButton";
import { CoordinatesPanel } from "./components/coordinates/CoordinatesPanel";
```

If `presentProPaywall` is not already imported in `App.tsx`, add:

```tsx
import { presentProPaywall } from "./lib/purchases";
```

Add panel state near the other `useState` hooks (e.g. beside `menuOpen`):

```tsx
const [coordsOpen, setCoordsOpen] = useState(false);
```

- [ ] **Step 3: Render the button (left) + the panel, with Pro gating**

In the header row where `<Avatar glyph={sunGlyph} />` is rendered, add the `CoordinatesButton` on the **left** side of that row (the Avatar stays on the right). Use the existing Pro gate (`isPro` from `useEntitlement(session)`, already in scope):

```tsx
<CoordinatesButton
  onPress={() => { if (isPro) setCoordsOpen(true); else void presentProPaywall(); }}
/>
```

Then render the panel once, near where `<HeaderMenu ... />` is rendered:

```tsx
<CoordinatesPanel
  visible={coordsOpen}
  onClose={() => setCoordsOpen(false)}
  natalPos={anonymous ? null : natalPos}
  livePos={livePos}
/>
```

> `anonymous ? null : natalPos` makes the **Fixed** column show the "Set your birth details" placeholder for anonymous users. Confirm the variable that marks an anonymous (no-birth) user in `App.tsx` — it may be `!session`, `tier === "anonymous"`, or a `birthMs == null` check. Use whichever the file already uses to decide birth-chart availability; if birth is always present once signed in, gate on the same condition the wheel uses to draw the natal layer. `livePos` is always present.

- [ ] **Step 4: Typecheck + tests**

Run: `cd apps/mobile && npm run typecheck` → Expected: no errors.
Run: `cd apps/mobile && npm test` → Expected: all tests pass (incl. the new `coordinateRows` test).

- [ ] **Step 5: Render-verify on the emulator**

Run the dev build (`npx expo run:android` with the JBR `JAVA_HOME`), open the app, tap the new left round button:
- As **Pro** (or with `isPro` forced true): the panel slides from the left with **Fixed** + **Moveable** columns; values match the wheel; switching the View updates the **Moveable** column live; a body at 29° shows the `29°` badge; a body within 1° of a boundary shows the `cusp` badge.
- As **non-Pro**: tapping presents the paywall.
- As **anonymous**: **Fixed** shows the "Set your birth details" placeholder; **Moveable** still has live data.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/CoordinatesButton.tsx apps/mobile/App.tsx
git commit -m "feat(mobile): left CoordinatesButton + panel wiring, Pro-gated"
```

---

## Notes for the implementer

- **Pro gate source:** `App.tsx` already has `const { isPro } = useEntitlement(session)` and `const tier = tierOf(...)`. Use `isPro` for the button gate. `presentProPaywall` lives in `apps/mobile/lib/purchases.ts`.
- **Glyph rendering:** always wrap glyph strings in `textGlyph(...)` and use `fontFamily: GLYPH_FONT` (from `components/chart/palette`) — that's how every other glyph in the app renders correctly cross-platform.
- **No new ephemeris bodies:** v1 is the 10 `PLANET_KEYS` only. ASC/Node/etc. are out of scope (spec §2 non-goals).
- **Staircase (v2):** the header's disabled "Staircase" tab is the seam for the aspectarian + modality table later (spec §9) — do not implement it here.
- **Verify-before-writing:** Tasks 3–5 reuse existing app helpers (`useTheme`, `Palette`, `GLYPH_FONT`, `textGlyph`, `Avatar` styling, the paywall, the anonymous check). Before each component, open the named source file and match its real export names/paths rather than trusting the paths in this plan verbatim — they reflect the codebase at plan-writing time and may have drifted.
- **Metro hot-reload** sometimes misses edits; press `r` in Metro to force a reload during Step 5.

## Self-review against the spec (done at plan time)

- §3 engine `decanOf`/`cuspOf`/`isAnaretic` → Task 1 (with boundary tests 0/9.99/10/20/29/29.99 and the face cycle). ✓
- §4 data flow (natal=Fixed, live=Moveable, no recompute) → Task 5 passes the existing `natalPos`/`livePos`; live updates because those props re-derive on each tick/View change. ✓
- §5 UI (`CoordinatesButton`, `CoordinatesPanel` left slide-out + switch stub, `CoordinateColumn`/`CoordinateRow`) → Tasks 3–5. ✓
- §6 gating (button always visible, paywall-on-tap; Fixed empty state) → Task 5 Step 3. ✓
- §7 testing (engine unit + UI render-verify) → Tasks 1–2 unit, Task 5 Step 5 render. ✓
- §9 deferred (Staircase, web, extra bodies) → explicitly excluded; Staircase stub only. ✓
