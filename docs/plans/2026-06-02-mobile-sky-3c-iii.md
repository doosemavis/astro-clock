# Mobile Day/Night Sky (Slice 3c-iii) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A starfield + soft day-sky gradient backdrop behind the wheel, cross-faded by `themeT` (night = stars, day = gradient).

**Architecture:** Pure `makeStars` (ported `mulberry32`, TDD). A `Sky` component renders a full-screen `<Svg>` (gradient `<Rect>` opacity `themeT` + 160 star `<Circle>`s opacity `1−themeT`). `App` mounts it behind the content. No new deps.

**Reference spec:** `docs/specs/2026-06-02-mobile-sky-3c-iii-design.md`

---

### Task 1: `lib/stars.ts` — `makeStars` (TDD)

**Files:** Create `apps/mobile/lib/stars.ts`, `apps/mobile/lib/stars.test.ts`.

- [ ] **Step 1: Failing test** — `stars.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStars } from "./stars.ts";

test("makeStars: count + deterministic + ranges", () => {
  const a = makeStars(160, 0x5eed);
  assert.equal(a.length, 160);
  const b = makeStars(160, 0x5eed);
  assert.deepEqual(a[0], b[0]); // same seed → identical
  for (const s of a) {
    assert.ok(s.cx >= 0 && s.cx < 100 && s.cy >= 0 && s.cy < 100);
    assert.ok(s.r >= 0.04 && s.r <= 0.17);
    assert.ok(s.o >= 0.25 && s.o <= 0.95);
  }
});
test("makeStars: a different seed yields a different first star", () => {
  assert.notDeepEqual(makeStars(160, 0x5eed)[0], makeStars(160, 0x1234)[0]);
});
```

- [ ] **Step 2: Run — fails.**

- [ ] **Step 3: Implement** — `stars.ts`:

```ts
export interface Star { cx: number; cy: number; r: number; o: number; }

/** Deterministic PRNG (ported from the web Starfield) — no Math.random, so identical on
 *  every platform/render. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fixed scatter of stars in a 0..100 box (cx/cy %, small radii, varied opacity). */
export function makeStars(count: number, seed: number): Star[] {
  const rnd = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    cx: +(rnd() * 100).toFixed(2),
    cy: +(rnd() * 100).toFixed(2),
    r: +(0.04 + rnd() * 0.13).toFixed(3),
    o: +(0.25 + rnd() * 0.7).toFixed(2),
  }));
}
```

- [ ] **Step 4: Run — passes.** **Commit**

```bash
git add apps/mobile/lib/stars.ts apps/mobile/lib/stars.test.ts
git commit -m "feat(mobile): makeStars deterministic starfield helper (TDD)"
```

---

### Task 2: `Sky` component (new)

**Files:** Create `apps/mobile/components/chart/Sky.tsx`.

- [ ] **Step 1: Write it**

```tsx
import { memo, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from "react-native-svg";
import { makeStars } from "../../lib/stars";

/** Full-screen sky backdrop behind the wheel: a day gradient that fades in with themeT and a
 *  starfield that fades out. themeT 0 = night (stars), 1 = day (gradient). */
function SkyBase({ themeT }: { themeT: number }) {
  const { width, height } = useWindowDimensions();
  const stars = useMemo(() => makeStars(160, 0x5eed), []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="sky-day" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#bcd6f5" />
            <Stop offset="1" stopColor="#7fa3d4" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#sky-day)" opacity={themeT} />
        <G opacity={1 - themeT}>
          {stars.map((s, i) => (
            <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#ffffff" opacity={s.o} />
          ))}
        </G>
      </Svg>
    </View>
  );
}

export const Sky = memo(SkyBase);
```

- [ ] **Step 2: Typecheck.** **Commit**

```bash
git add apps/mobile/components/chart/Sky.tsx
git commit -m "feat(mobile): Sky — starfield + day-gradient backdrop (faded by themeT)"
```

---

### Task 3: Mount `Sky` in `App`

**Files:** Modify `apps/mobile/App.tsx`.

- [ ] **Step 1:** Import `import { Sky } from "./components/chart/Sky";`.
- [ ] **Step 2:** Render `<Sky themeT={themeT} />` immediately inside the root `View`, before the header:

```tsx
<ThemeProvider value={{ t: themeT, palette }}>
  <View style={styles.root}>
    <Sky themeT={themeT} />
    <View style={styles.header}>
    …
```

(`Sky` is `absoluteFill` + `pointerEvents="none"`, so it sits behind everything and never blocks touches.)

- [ ] **Step 3: Typecheck + tests.** **Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): mount Sky backdrop behind the chart (day/night sky live)"
```

---

### Task 4: Verify

- [ ] `pnpm --filter @astro/mobile typecheck`; `pnpm --filter @astro/mobile test`; `pnpm --filter @astro/engine test` — green (incl. new `makeStars` tests).
- [ ] `cd apps/mobile && npx expo export --platform android` — bundles.
- [ ] Web `/browse` (390×844): **Dark** → starfield over dark bg; **Light** → day gradient (stars gone); **Auto** → set Range and play across a day, watch night→day; wheel/controls on top.
- [ ] Hand off for device.

---

## Completion
After all tasks verify and the user confirms (or per go-ahead): use superpowers:finishing-a-development-branch — verify tests, then merge (PR). **This completes Slice 3c → full web parity on mobile.**
