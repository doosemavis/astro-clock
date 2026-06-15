# Dynamic Onboarding Walkthrough — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-run animated walkthrough (5 swipeable slides reusing the real `ChartWheel`) that orients new users and funnels them to sign-up — soft at slide 1, insistent at slide 5.

**Architecture:** Pure data + storage (`lib/onboarding.ts`, `lib/onboardingStorage.ts`) drive a full-screen overlay (`OnboardingWalkthrough.tsx`) whose per-slide demo (`OnboardingDemo.tsx`) animates a small `ChartWheel`. `App.tsx` shows it on first launch (AsyncStorage flag `movestar.onboarding.v1`) and a `HeaderMenu` row replays it.

**Tech Stack:** React Native + Expo, `react-native-svg` (`ChartWheel`), `@astro/engine` (`positions`/`DEFAULT_BIRTH`), AsyncStorage. No new dependencies. Pure-logic tests via `node --test` (`pnpm --filter @astro/mobile test`).

**Spec:** `docs/superpowers/specs/2026-06-15-mobile-onboarding-walkthrough-design.md`

**Plan-level simplification (flagged):** v1 implements 3 demo kinds — `live`, `natal`, `timetravel`. The spec mentioned a separate `compare` two-wheel demo on slide 4; that's dropped for v1 (slide 4 shows the time-travel sweep, which is the most "dynamic", and the copy still names Compare). Keeps `OnboardingDemo` lean. Easy to add later.

---

## File structure

```
apps/mobile/
  lib/
    onboarding.ts            # CREATE — types, SLIDES (pure data), parseOnboardingSeen, SEEN_VALUE
    onboarding.test.ts       # CREATE — slide invariants + parse tests (node --test)
    onboardingStorage.ts     # CREATE — load/saveOnboardingSeen (AsyncStorage movestar.onboarding.v1)
  components/onboarding/
    OnboardingDemo.tsx       # CREATE — animated ChartWheel per demo kind
    OnboardingWalkthrough.tsx# CREATE — full-screen paged overlay + dots + Skip/Next/CTAs
  components/HeaderMenu.tsx   # MODIFY — add "How it works" replay row + prop
  App.tsx                    # MODIFY — load flag on launch, render overlay, wire CTAs + replay
```

---

## Task 0: New branch off main

- [ ] **Step 1: Create the branch**

```bash
cd /Users/moosedavis/dev/astro-clock
git checkout main && git pull
git checkout -b feat/mobile-onboarding
```
(The uncommitted spec file carries over with the checkout — that's intended; it belongs with this feature.)

- [ ] **Step 2: Commit the spec + plan onto the new branch**

```bash
git add docs/superpowers/specs/2026-06-15-mobile-onboarding-walkthrough-design.md \
        docs/superpowers/plans/2026-06-15-mobile-onboarding-walkthrough.md
git commit -m "docs(onboarding): walkthrough design spec + implementation plan"
```

---

## Task 1: `lib/onboarding.ts` — pure data + parse (TDD)

**Files:** Create `apps/mobile/lib/onboarding.ts`, `apps/mobile/lib/onboarding.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/lib/onboarding.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SLIDES, parseOnboardingSeen, SEEN_VALUE } from "./onboarding.ts";

test("parseOnboardingSeen: only the exact seen value is true", () => {
  assert.equal(parseOnboardingSeen(SEEN_VALUE), true);
  assert.equal(parseOnboardingSeen(null), false);
  assert.equal(parseOnboardingSeen("0"), false);
  assert.equal(parseOnboardingSeen("true"), false);
});

test("SLIDES: exactly 5 slides", () => {
  assert.equal(SLIDES.length, 5);
});

test("SLIDES: first and last slides offer create-account (bookended funnel)", () => {
  const hasCreate = (s: { primary: { action: string }; secondary?: { action: string } }) =>
    s.primary.action === "createAccount" || s.secondary?.action === "createAccount";
  assert.equal(hasCreate(SLIDES[0]), true);
  assert.equal(hasCreate(SLIDES[SLIDES.length - 1]), true);
});

test("SLIDES: every slide has content + a valid demo kind", () => {
  const kinds = new Set(["live", "natal", "timetravel"]);
  for (const s of SLIDES) {
    assert.ok(s.title.length > 0, `${s.id} title`);
    assert.ok(s.body.length > 0, `${s.id} body`);
    assert.ok(kinds.has(s.demo), `${s.id} demo`);
    assert.ok(s.primary.label.length > 0, `${s.id} primary`);
  }
});
```

- [ ] **Step 2: Run it — expect FAIL** (module not found)

```bash
pnpm --filter @astro/mobile test 2>&1 | grep -i onboarding
```
Expected: failure importing `./onboarding.ts`.

- [ ] **Step 3: Implement `apps/mobile/lib/onboarding.ts`**

```ts
// Pure onboarding data + helpers (no React, no AsyncStorage) so node --test can cover it.

export type DemoKind = "live" | "natal" | "timetravel";
export type CtaAction = "createAccount" | "next" | "dismiss";
export interface SlideCta { label: string; action: CtaAction; }
export interface Slide {
  id: string;
  title: string;
  body: string;
  demo: DemoKind;
  primary: SlideCta;
  secondary?: SlideCta;
}

export const SLIDES: Slide[] = [
  {
    id: "welcome",
    title: "Welcome to MoveStar",
    body: "Your living sky — the real planets, in real time.",
    demo: "live",
    primary: { label: "Create free account", action: "createAccount" },
    secondary: { label: "Maybe later", action: "next" },
  },
  {
    id: "live",
    title: "The live sky",
    body: "Watch the actual planets move in real time.",
    demo: "live",
    primary: { label: "Next", action: "next" },
  },
  {
    id: "birth",
    title: "Your birth chart",
    body: "Cast your birth chart — Sun, Moon & Rising — and save it as a wallpaper.",
    demo: "natal",
    primary: { label: "Next", action: "next" },
  },
  {
    id: "go-further",
    title: "Go further",
    body: "Travel to any date, animate a date range, and compare two charts.",
    demo: "timetravel",
    primary: { label: "Next", action: "next" },
  },
  {
    id: "create",
    title: "See your chart",
    body: "Want to see your birth chart with all these features? Create an account.",
    demo: "natal",
    primary: { label: "Create account", action: "createAccount" },
    secondary: { label: "Continue to the live sky", action: "dismiss" },
  },
];

/** AsyncStorage value meaning "the walkthrough has been seen". */
export const SEEN_VALUE = "1";

/** Parse the persisted onboarding flag: only the exact SEEN_VALUE counts as seen. */
export function parseOnboardingSeen(raw: string | null): boolean {
  return raw === SEEN_VALUE;
}
```

- [ ] **Step 4: Run it — expect PASS**

```bash
pnpm --filter @astro/mobile test 2>&1 | tail -8
```
Expected: all suites pass (previous 90 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/onboarding.ts apps/mobile/lib/onboarding.test.ts
git commit -m "feat(onboarding): slide data + seen-flag parse (pure, tested)"
```

---

## Task 2: `lib/onboardingStorage.ts` — AsyncStorage wrapper

**Files:** Create `apps/mobile/lib/onboardingStorage.ts` (parse is already tested in Task 1; this thin wrapper mirrors `themeStorage.ts` and isn't separately unit-tested).

- [ ] **Step 1: Implement `apps/mobile/lib/onboardingStorage.ts`**

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseOnboardingSeen, SEEN_VALUE } from "./onboarding.ts";

const KEY = "movestar.onboarding.v1";

/** Has the first-run walkthrough been seen? false on absent/corrupt/read-error (so it shows once). */
export async function loadOnboardingSeen(): Promise<boolean> {
  try {
    return parseOnboardingSeen(await AsyncStorage.getItem(KEY));
  } catch {
    return false;
  }
}

/** Mark the walkthrough seen (local cache only; ignore write errors). */
export async function saveOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, SEEN_VALUE);
  } catch {
    /* local cache only */
  }
}
```

- [ ] **Step 2: Sanity-check the test suite still passes**

```bash
pnpm --filter @astro/mobile test 2>&1 | tail -4
```
Expected: pass (no new tests; confirms no import breakage).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/onboardingStorage.ts
git commit -m "feat(onboarding): AsyncStorage seen-flag (movestar.onboarding.v1)"
```

---

## Task 3: `components/onboarding/OnboardingDemo.tsx` — animated wheel

**Files:** Create `apps/mobile/components/onboarding/OnboardingDemo.tsx`. Reuses `ChartWheel` (props: `natalPositions`, `livePositions`, `size`, `showNatal`, `showMajor`, `showMinor`). `live` ticks the real sky; `timetravel` sweeps an instant on a loop; `natal` is a still sample chart.

- [ ] **Step 1: Implement the component**

```tsx
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { DEFAULT_BIRTH, birthInstant, positions } from "@astro/engine";
import type { Positions } from "@astro/engine";
import type { DemoKind } from "../../lib/onboarding";
import { ChartWheel } from "../chart/ChartWheel";

const SAMPLE_NATAL: Positions = positions(birthInstant(DEFAULT_BIRTH));
const SWEEP_START = birthInstant(DEFAULT_BIRTH).getTime();
const SWEEP_SPAN_MS = 365 * 24 * 3600 * 1000;   // loop over one year
const SWEEP_STEP_MS = 48 * 3600 * 1000;          // +48h per tick → planets visibly move
const SWEEP_INTERVAL = 90;                        // ms between ticks (~11 fps)

/** A small animated ChartWheel demoing one feature for the onboarding walkthrough. */
export function OnboardingDemo({ kind, size }: { kind: DemoKind; size: number }) {
  const [liveMs, setLiveMs] = useState(() => Date.now());
  const [sweepMs, setSweepMs] = useState(SWEEP_START);

  useEffect(() => {
    if (kind === "live") {
      const id = setInterval(() => setLiveMs(Date.now()), 1000);
      return () => clearInterval(id);
    }
    if (kind === "timetravel") {
      const id = setInterval(
        () => setSweepMs((ms) => SWEEP_START + ((ms - SWEEP_START + SWEEP_STEP_MS) % SWEEP_SPAN_MS)),
        SWEEP_INTERVAL,
      );
      return () => clearInterval(id);
    }
    return undefined; // "natal": static
  }, [kind]);

  const livePos = useMemo(() => {
    if (kind === "live") return positions(new Date(liveMs));
    if (kind === "timetravel") return positions(new Date(sweepMs));
    return SAMPLE_NATAL; // natal
  }, [kind, liveMs, sweepMs]);

  return (
    <View style={{ width: size, height: size }}>
      <ChartWheel
        size={size}
        natalPositions={SAMPLE_NATAL}
        livePositions={livePos}
        showNatal={kind === "natal"}
        showMajor
        showMinor={false}
      />
    </View>
  );
}
```

- [ ] **Step 2: Commit** (component verified later on the emulator, Task 7)

```bash
git add apps/mobile/components/onboarding/OnboardingDemo.tsx
git commit -m "feat(onboarding): animated ChartWheel demo (live/natal/timetravel)"
```

---

## Task 4: `components/onboarding/OnboardingWalkthrough.tsx` — the overlay

**Files:** Create `apps/mobile/components/onboarding/OnboardingWalkthrough.tsx`. A full-screen `Modal` with a horizontal paging `FlatList` of `SLIDES`, progress dots, a Skip button, and per-slide primary/secondary CTAs. Styling mirrors `HeaderMenu`/app palette via `useTheme()`.

- [ ] **Step 1: Implement the component**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal, View, Text, Pressable, StyleSheet, FlatList, useWindowDimensions,
  type ListRenderItemInfo, type NativeSyntheticEvent, type NativeScrollEvent,
} from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { SLIDES, type Slide, type CtaAction } from "../../lib/onboarding";
import { OnboardingDemo } from "./OnboardingDemo";

interface Props {
  visible: boolean;
  onDismiss: () => void;        // skip / maybe-later-to-Now / continue → anonymous Now
  onCreateAccount: () => void;  // any create-account CTA → open sign-up
}

export function OnboardingWalkthrough({ visible, onDismiss, onCreateAccount }: Props) {
  const { palette: p } = useTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(p), [p]);
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const demoSize = Math.min(width * 0.72, 320);

  // Reset to the first slide whenever the overlay (re)opens — e.g. replay from the menu.
  useEffect(() => {
    if (visible) {
      setIndex(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  }, [visible]);

  function act(action: CtaAction) {
    if (action === "createAccount") return onCreateAccount();
    if (action === "dismiss") return onDismiss();
    if (index < SLIDES.length - 1) {            // "next"
      const next = index + 1;
      setIndex(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    } else {
      onDismiss();
    }
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  }

  function renderItem({ item }: ListRenderItemInfo<Slide>) {
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.demoBox}><OnboardingDemo kind={item.demo} size={demoSize} /></View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
      </View>
    );
  }

  const slide = SLIDES[index];
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Pressable style={styles.skip} onPress={onDismiss} hitSlop={10}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        />

        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.id} style={[styles.dot, i === index ? styles.dotActive : null]} />
          ))}
        </View>

        <View style={styles.ctas}>
          <Pressable style={styles.primaryBtn} onPress={() => act(slide.primary.action)}>
            <Text style={styles.primaryText}>{slide.primary.label}</Text>
          </Pressable>
          {slide.secondary ? (
            <Pressable style={styles.secondaryBtn} onPress={() => act(slide.secondary!.action)}>
              <Text style={styles.secondaryText}>{slide.secondary.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: p.bg, paddingTop: 64, paddingBottom: 40 },
  skip: { position: "absolute", top: 56, right: 20, zIndex: 10, padding: 8 },
  skipText: { color: p.textDim, fontSize: 15, fontWeight: "600" },
  slide: { alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 24 },
  demoBox: { alignItems: "center", justifyContent: "center" },
  title: { color: p.text, fontSize: 26, fontWeight: "700", textAlign: "center", letterSpacing: 0.5 },
  body: { color: p.textDim, fontSize: 16, lineHeight: 23, textAlign: "center", maxWidth: 320 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: p.border },
  dotActive: { backgroundColor: p.text, width: 18 },
  ctas: { paddingHorizontal: 28, gap: 10 },
  primaryBtn: { backgroundColor: p.text, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  primaryText: { color: p.bg, fontSize: 16, fontWeight: "700" },
  secondaryBtn: { paddingVertical: 12, alignItems: "center" },
  secondaryText: { color: p.textDim, fontSize: 15, fontWeight: "600" },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/onboarding/OnboardingWalkthrough.tsx
git commit -m "feat(onboarding): full-screen paged walkthrough overlay"
```

---

## Task 5: Wire into `App.tsx`

**Files:** Modify `apps/mobile/App.tsx`.

- [ ] **Step 1: Add imports** (with the other component/lib imports near the top)

```tsx
import { OnboardingWalkthrough } from "./components/onboarding/OnboardingWalkthrough";
import { loadOnboardingSeen, saveOnboardingSeen } from "./lib/onboardingStorage";
```

- [ ] **Step 2: Add state + launch load + handlers** (inside `AppInner`, near the other `useState`/`useEffect` blocks)

```tsx
const [onboardingVisible, setOnboardingVisible] = useState(false);

// First launch: show the walkthrough unless it's been seen.
useEffect(() => {
  let active = true;
  loadOnboardingSeen().then((seen) => { if (active && !seen) setOnboardingVisible(true); });
  return () => { active = false; };
}, []);

const dismissOnboarding = () => { void saveOnboardingSeen(); setOnboardingVisible(false); };
const createAccountFromOnboarding = () => {
  void saveOnboardingSeen();
  setOnboardingVisible(false);
  setAuthView("login");
};
const replayOnboarding = () => { setMenuOpen(false); setOnboardingVisible(true); };
```

- [ ] **Step 3: Render the overlay** — add just before `<StatusBar style="light" />` near the end of the returned JSX:

```tsx
      <OnboardingWalkthrough
        visible={onboardingVisible && fontsLoaded}
        onDismiss={dismissOnboarding}
        onCreateAccount={createAccountFromOnboarding}
      />
```

- [ ] **Step 4: Pass the replay handler to `HeaderMenu`** — in the existing `<HeaderMenu … />` props, add:

```tsx
        onReplayWalkthrough={replayOnboarding}
```

- [ ] **Step 5: Type-check / suite sanity (no unit test for App)**

```bash
pnpm --filter @astro/mobile test 2>&1 | tail -4
```
Expected: pass (unchanged suite; confirms imports resolve). Full verification on the emulator in Task 7.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(onboarding): show on first launch; create-account + replay wiring"
```

---

## Task 6: `HeaderMenu` — "How it works" replay row

**Files:** Modify `apps/mobile/components/HeaderMenu.tsx`.

- [ ] **Step 1: Add the prop** — extend the `Props` interface:

```tsx
  onReplayWalkthrough: () => void;  // replay the onboarding walkthrough
```

- [ ] **Step 2: Destructure it** in the component signature:

```tsx
export function HeaderMenu({
  visible, signedIn, canShare, canSave, themeMode, onTheme, onClose, onAuth, onEditBirth, onSave, onShare, onReplayWalkthrough,
}: Props) {
```

- [ ] **Step 3: Add the row** — insert after the Theme row block (after its closing `</View>` for `themeRow`), before the `canSave` block:

```tsx
        <View style={styles.divider} />
        <Pressable style={styles.item} onPress={onReplayWalkthrough}>
          <Text style={styles.itemText}>How it works</Text>
        </Pressable>
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/HeaderMenu.tsx
git commit -m "feat(onboarding): How it works row to replay the walkthrough"
```

---

## Task 7: Verify on the Pixel_7 emulator

**Prereq:** emulator + Metro running (per `mobile-android-dev-build`). `ADB="$ANDROID_HOME/platform-tools/adb"`.

- [ ] **Step 1: Force first-run by clearing the flag, then relaunch**

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"; ADB="$ANDROID_HOME/platform-tools/adb"
"$ADB" shell am force-stop com.movestar.app
# Clear just the onboarding key. If on-device sqlite3 is unavailable, pull RKStorage, delete the
# row locally with python sqlite3, and push back via `run-as cp` (the screenshots plan's method).
"$ADB" exec-out run-as com.movestar.app cat databases/RKStorage > /tmp/RK.db
python3 -c "import sqlite3; c=sqlite3.connect('/tmp/RK.db'); c.execute(\"DELETE FROM catalystLocalStorage WHERE key='movestar.onboarding.v1'\"); c.commit()"
"$ADB" push /tmp/RK.db /data/local/tmp/RK.db >/dev/null
"$ADB" shell run-as com.movestar.app cp /data/local/tmp/RK.db databases/RKStorage
"$ADB" shell run-as com.movestar.app rm -f databases/RKStorage-journal
"$ADB" shell am start -n com.movestar.app/.MainActivity
```

- [ ] **Step 2: Walk the flow** (capture with `"$ADB" exec-out screencap -p > /tmp/onb.png`):
  - Walkthrough appears on launch (slide 1, "Create free account" + "Maybe later").
  - Slide 2 wheel is **ticking** (live); slide 4 planets **sweep** (time-travel).
  - Swipe + Next advance; dots track; **Skip** dismisses to the Now view.
  - Relaunch → walkthrough does **not** reappear (flag persisted).
  - ☰ menu → **How it works** replays it (starts at slide 1).
  - Slide 5 **Create account** → opens the sign-in/sign-up screen; on close, lands on Now.

- [ ] **Step 3: No commit** (verification only).

---

## Task 8: Finish the branch

- [ ] **Step 1:** Use **superpowers:finishing-a-development-branch** — verify `pnpm --filter @astro/mobile test` passes, then present merge/PR options for `feat/mobile-onboarding`.

---

## Self-review notes (against the spec)

- **Trigger/persistence/replay** → Tasks 2, 5, 6 (`movestar.onboarding.v1`, launch load, "How it works").
- **5 bookended slides + funnel** → Task 1 `SLIDES` (+ invariant test); soft slide 1 (`Maybe later`=next), insistent slide 5 (`Create account` primary).
- **Dynamic demos reusing ChartWheel** → Task 3 (`live` tick, `timetravel` sweep, `natal` still).
- **Overlay (paged, dots, Skip, CTAs)** → Task 4.
- **App/HeaderMenu wiring; create-account → existing auth** → Tasks 5, 6 (`setAuthView("login")`).
- **Best-effort AsyncStorage; tests for parse + slide config** → Tasks 1, 2.
- **Type consistency:** `DemoKind` (`live|natal|timetravel`), `CtaAction` (`createAccount|next|dismiss`), `Slide`/`SlideCta`, `SEEN_VALUE` used identically across `onboarding.ts`, `OnboardingDemo`, `OnboardingWalkthrough`, storage, and the test.
- **Deviation:** `compare` demo dropped for v1 (slide 4 = time-travel sweep; copy still names Compare) — flagged in the header.
