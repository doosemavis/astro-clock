# Sign-in Gate + Signed-out "Now" Placeholder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the mobile app into 3 tiers — anonymous (Now-only live placeholder, no controls, sign-in prompt), Free (signed-in: Birth+Now + Clock/Theme/Aspects), Pro (subscribed: Date/Range/Compare + Glyphs, shown locked for now) — without building any purchase flow.

**Architecture:** A pure `entitlement.ts` derives `isPro` + `tier`; a `useEntitlement` hook reads the `subscriptions` row. `App.tsx` derives the tier and gates: anonymous forces Now, hides the natal layer + controls, shows a live ☉/☽ Big Three and a sign-in prompt. `ChartControls` locks Pro modes/Glyphs behind a placeholder `ProLockSheet`. Pure logic is split from `supabase`-importing code so it unit-tests under `node --test`.

**Tech Stack:** Expo SDK 54 / React Native 0.81 / React 19, `@supabase/supabase-js` v2. Tests: `node --test --experimental-strip-types "lib/*.test.ts"` (pure TS only — no RN/supabase imports load there).

**Spec:** `docs/specs/2026-06-03-signin-gate-and-now-placeholder-design.md`.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/mobile/lib/entitlement.ts` (+ `.test.ts`) | **pure** `entitlementFromRow`, `tierOf`, types — no supabase import (TDD) |
| `apps/mobile/hooks/useEntitlement.ts` | fetch the subscriptions row → `isPro` (imports supabase + pure fns) |
| `apps/mobile/components/SignInPrompt.tsx` | anonymous "Sign in to chart your birth →" pill |
| `apps/mobile/components/ProLockSheet.tsx` | placeholder Pro teaser ("Unlock more cool features with Pro!") |
| `apps/mobile/components/HeaderMenu.tsx` | hide "Edit birth details" when signed out |
| `apps/mobile/components/chart/ChartWheel.tsx` | add `showNatal?: boolean` to hide the natal layer |
| `apps/mobile/components/chart/ChartControls.tsx` | accept `isPro`; lock Pro modes + Glyphs → ProLockSheet |
| `apps/mobile/App.tsx` | derive tier; force-Now; conditional bigThree / natal / controls / prompt; pass `isPro` |

**Out of scope:** the subscription purchase flow (deferred).

---

## Task 1: Entitlement pure logic (TDD)

Pure module — **no `supabase` import** so it loads under `node --test`.

**Files:**
- Create: `apps/mobile/lib/entitlement.ts`
- Test: `apps/mobile/lib/entitlement.test.ts`

- [ ] **Step 1: Write the failing test** — `apps/mobile/lib/entitlement.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { entitlementFromRow, tierOf } from "./entitlement.ts";

test("entitlementFromRow: null row → not Pro", () => {
  assert.equal(entitlementFromRow(null).isPro, false);
});

test("entitlementFromRow: active with a future period end → Pro", () => {
  assert.equal(entitlementFromRow({ status: "active", current_period_end: "2999-01-01T00:00:00Z" }).isPro, true);
});

test("entitlementFromRow: trialing with a future period end → Pro", () => {
  assert.equal(entitlementFromRow({ status: "trialing", current_period_end: "2999-01-01T00:00:00Z" }).isPro, true);
});

test("entitlementFromRow: active but expired → not Pro", () => {
  assert.equal(entitlementFromRow({ status: "active", current_period_end: "2000-01-01T00:00:00Z" }).isPro, false);
});

test("entitlementFromRow: canceled (future end) → not Pro", () => {
  assert.equal(entitlementFromRow({ status: "canceled", current_period_end: "2999-01-01T00:00:00Z" }).isPro, false);
});

test("entitlementFromRow: active but null period end → not Pro", () => {
  assert.equal(entitlementFromRow({ status: "active", current_period_end: null }).isPro, false);
});

test("tierOf: signed out → anonymous (even if isPro somehow true)", () => {
  assert.equal(tierOf(false, false), "anonymous");
  assert.equal(tierOf(false, true), "anonymous");
});

test("tierOf: signed in maps to free / pro", () => {
  assert.equal(tierOf(true, false), "free");
  assert.equal(tierOf(true, true), "pro");
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `pnpm --filter @astro/mobile test`
Expected: FAIL — `Cannot find module './entitlement.ts'`.

- [ ] **Step 3: Implement `apps/mobile/lib/entitlement.ts`**
```ts
export type Tier = "anonymous" | "free" | "pro";

/** Minimal shape of the public.subscriptions row we read. */
export interface SubscriptionRow {
  status?: string | null;
  current_period_end?: string | null;
}

/** Pure: derive Pro entitlement from a subscriptions row. null/expired/inactive → Free.
 *  isPro = status is active|trialing AND current_period_end is in the future. */
export function entitlementFromRow(row: SubscriptionRow | null): { isPro: boolean } {
  if (!row) return { isPro: false };
  const active = row.status === "active" || row.status === "trialing";
  const end = row.current_period_end ? Date.parse(row.current_period_end) : NaN;
  return { isPro: active && Number.isFinite(end) && end > Date.now() };
}

/** Pure: the access tier from auth + entitlement. Signed-out is always anonymous. */
export function tierOf(signedIn: boolean, isPro: boolean): Tier {
  if (!signedIn) return "anonymous";
  return isPro ? "pro" : "free";
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS (8 new tests + the existing suite stay green).

- [ ] **Step 5: Commit**
```bash
git add apps/mobile/lib/entitlement.ts apps/mobile/lib/entitlement.test.ts
git commit -m "feat(mobile): entitlement pure logic (entitlementFromRow, tierOf)"
```

---

## Task 2: `useEntitlement` hook

Reads the caller's subscription row → `isPro`. Imports supabase (not unit-tested; verified by typecheck). Defaults Free on any error.

**Files:**
- Create: `apps/mobile/hooks/useEntitlement.ts`

- [ ] **Step 1: Implement `apps/mobile/hooks/useEntitlement.ts`**
```ts
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { entitlementFromRow } from "../lib/entitlement";

/** Read the signed-in user's subscription row and derive isPro. Defaults Free on error. */
async function fetchIsPro(): Promise<boolean> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .maybeSingle();
  if (error) {
    console.warn("entitlement fetch failed (defaulting Free):", error.message);
    return false;
  }
  return entitlementFromRow(data).isPro;
}

/** isPro for the current session; refetches when the user changes, Free when signed out. */
export function useEntitlement(session: Session | null): { isPro: boolean } {
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    if (!session) { setIsPro(false); return; }
    let active = true;
    fetchIsPro()
      .then((v) => { if (active) setIsPro(v); })
      .catch(() => { if (active) setIsPro(false); });
    return () => { active = false; };
  }, [session?.user?.id]);
  return { isPro };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add apps/mobile/hooks/useEntitlement.ts
git commit -m "feat(mobile): useEntitlement hook (reads subscriptions → isPro)"
```

---

## Task 3: `SignInPrompt` component

A themed pill shown on the anonymous Now view.

**Files:**
- Create: `apps/mobile/components/SignInPrompt.tsx`

- [ ] **Step 1: Implement `apps/mobile/components/SignInPrompt.tsx`**
```tsx
import { useMemo } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";

/** Anonymous-view call to action: tap to open the login sheet. */
export function SignInPrompt({ onPress }: { onPress: () => void }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <Pressable style={styles.prompt} onPress={onPress} hitSlop={8}>
      <Text style={styles.text}>Sign in to chart your birth →</Text>
    </Pressable>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  prompt: {
    marginTop: 14, alignSelf: "center",
    backgroundColor: p.panel, borderColor: p.live, borderWidth: 1,
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 11,
  },
  text: { color: p.live, fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add apps/mobile/components/SignInPrompt.tsx
git commit -m "feat(mobile): SignInPrompt pill for the anonymous view"
```

---

## Task 4: `ProLockSheet` component

Placeholder Pro teaser (no Subscribe button yet).

**Files:**
- Create: `apps/mobile/components/ProLockSheet.tsx`

- [ ] **Step 1: Implement `apps/mobile/components/ProLockSheet.tsx`**
```tsx
import { useMemo } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../lib/theme";

/** Placeholder upgrade teaser shown when a Free user taps a Pro-locked feature.
 *  No purchase CTA yet — the subscription flow is a separate, deferred slice. */
export function ProLockSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.card} onStartShouldSetResponder={() => true}>
        <Text style={styles.title}>Unlock more cool features with Pro!</Text>
        <Text style={styles.body}>Pro adds the Date, Range & Compare views and per-planet Glyph customization.</Text>
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  card: {
    position: "absolute", left: 24, right: 24, top: "38%",
    backgroundColor: p.panel, borderColor: p.border, borderWidth: 1, borderRadius: 16,
    padding: 20,
  },
  title: { color: p.text, fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  body: { color: p.textDim, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  close: { backgroundColor: p.live, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  closeText: { color: p.bg, fontSize: 15, fontWeight: "700" },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add apps/mobile/components/ProLockSheet.tsx
git commit -m "feat(mobile): ProLockSheet placeholder upgrade teaser"
```

---

## Task 5: `ChartWheel` — `showNatal` prop

**Files:**
- Modify: `apps/mobile/components/chart/ChartWheel.tsx`

- [ ] **Step 1: Add the prop + gate the natal layer**

In `apps/mobile/components/chart/ChartWheel.tsx`, add `showNatal?: boolean` to `Props` (after `vis?: Vis;`):
```tsx
  showNatal?: boolean;
```
Change the function signature default list to include it (default `true`):
```tsx
function ChartWheelBase({ natalPositions, livePositions, curvedLabels = true, showMajor = true, showMinor = true, vis, showNatal = true }: Props) {
```
Replace the natal layer line:
```tsx
        <NatalLayer positions={natalPositions} vis={vis?.natal} />
```
with:
```tsx
        {showNatal ? <NatalLayer positions={natalPositions} vis={vis?.natal} /> : null}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add apps/mobile/components/chart/ChartWheel.tsx
git commit -m "feat(mobile): ChartWheel showNatal prop (hide natal layer for anonymous)"
```

---

## Task 6: `HeaderMenu` — hide "Edit birth details" when signed out

**Files:**
- Modify: `apps/mobile/components/HeaderMenu.tsx`

- [ ] **Step 1: Gate the edit-birth item**

In `apps/mobile/components/HeaderMenu.tsx`, replace this block:
```tsx
        <Pressable style={styles.item} onPress={onAuth}>
          <Text style={styles.itemText}>{signedIn ? "Account" : "Sign in"}</Text>
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.item} onPress={onEditBirth}>
          <Text style={styles.itemText}>Edit birth details</Text>
        </Pressable>
```
with:
```tsx
        <Pressable style={styles.item} onPress={onAuth}>
          <Text style={styles.itemText}>{signedIn ? "Account" : "Sign in"}</Text>
        </Pressable>
        {signedIn ? (
          <>
            <View style={styles.divider} />
            <Pressable style={styles.item} onPress={onEditBirth}>
              <Text style={styles.itemText}>Edit birth details</Text>
            </Pressable>
          </>
        ) : null}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add apps/mobile/components/HeaderMenu.tsx
git commit -m "feat(mobile): hide Edit birth details in the menu when signed out"
```

---

## Task 7: `ChartControls` — lock Pro modes + Glyphs

**Files:**
- Modify: `apps/mobile/components/chart/ChartControls.tsx`

- [ ] **Step 1: Add the `isPro` prop + imports**

Add the import (after the `VisGrid` import on line 13):
```tsx
import { ProLockSheet } from "../ProLockSheet";
```
Add `isPro: boolean;` to the `Props` interface (after `clock: ChartClock;`):
```tsx
  isPro: boolean;
```
Add `isPro` to the destructured params in the function signature:
```tsx
export function ChartControls({
  clock, isPro, timeFormat, onTimeFormat, showMajor, onToggleMajor, showMinor, onToggleMinor,
  themeMode, onTheme, vis, onToggleVis,
}: Props) {
```

- [ ] **Step 2: Add Pro-lock state + a gated mode handler**

Immediately after the `const { mode, setMode, ... } = clock;` destructuring block, add:
```tsx
  const [proLock, setProLock] = useState(false);
  const PRO_MODES: Mode[] = ["moment", "range", "compare"];
  const modeOptions = MODES.map((m) =>
    !isPro && PRO_MODES.includes(m.key) ? { key: m.key, label: `${m.label} 🔒` } : m,
  );
  const onModeChange = (m: Mode) => {
    if (!isPro && PRO_MODES.includes(m)) { setProLock(true); return; }
    setMode(m);
  };
```
(`useState` is already imported on line 1.)

- [ ] **Step 3: Use the gated options + handler in the View switcher**

Replace:
```tsx
      <Section label="View">
        <Segmented options={MODES} value={mode} onChange={setMode} wrap />
      </Section>
```
with:
```tsx
      <Section label="View">
        <Segmented options={modeOptions} value={mode} onChange={onModeChange} wrap />
      </Section>
```

- [ ] **Step 4: Lock the Glyphs section**

Replace:
```tsx
      <Section label="Glyphs">
        <VisGrid vis={vis} onToggle={onToggleVis} />
      </Section>
```
with:
```tsx
      <Section label="Glyphs">
        {isPro ? (
          <VisGrid vis={vis} onToggle={onToggleVis} />
        ) : (
          <Pressable style={styles.locked} onPress={() => setProLock(true)}>
            <Text style={styles.lockedText}>🔒 Glyph customization is a Pro feature</Text>
          </Pressable>
        )}
      </Section>
```

- [ ] **Step 5: Render the ProLockSheet**

Replace the closing of the component:
```tsx
      <Section label="Aspects">
        <View style={styles.rowTight}>
          <Pressable style={[styles.btn, showMajor && styles.btnOn]} onPress={onToggleMajor}>
            <Text style={[styles.btnText, showMajor && styles.btnTextOn]}>Major</Text>
          </Pressable>
          <Pressable style={[styles.btn, showMinor && styles.btnOn]} onPress={onToggleMinor}>
            <Text style={[styles.btnText, showMinor && styles.btnTextOn]}>Minor</Text>
          </Pressable>
        </View>
      </Section>
    </View>
  );
}
```
with (add `<ProLockSheet …/>` before the closing `</View>`):
```tsx
      <Section label="Aspects">
        <View style={styles.rowTight}>
          <Pressable style={[styles.btn, showMajor && styles.btnOn]} onPress={onToggleMajor}>
            <Text style={[styles.btnText, showMajor && styles.btnTextOn]}>Major</Text>
          </Pressable>
          <Pressable style={[styles.btn, showMinor && styles.btnOn]} onPress={onToggleMinor}>
            <Text style={[styles.btnText, showMinor && styles.btnTextOn]}>Minor</Text>
          </Pressable>
        </View>
      </Section>

      <ProLockSheet visible={proLock} onClose={() => setProLock(false)} />
    </View>
  );
}
```

- [ ] **Step 6: Add the locked styles**

In `makeStyles`, add (after the `note` style, before the closing `});`):
```tsx
  locked: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  lockedText: { color: p.textDim, fontSize: 13 },
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**
```bash
git add apps/mobile/components/chart/ChartControls.tsx
git commit -m "feat(mobile): lock Pro modes + Glyphs behind ProLockSheet"
```

---

## Task 8: Wire the gate into `App.tsx`

**Files:**
- Modify: `apps/mobile/App.tsx`

- [ ] **Step 1: Add imports**

After the `import { HeaderMenu } from "./components/HeaderMenu";` line, add:
```tsx
import { SignInPrompt } from "./components/SignInPrompt";
import { useEntitlement } from "./hooks/useEntitlement";
import { tierOf } from "./lib/entitlement";
```

- [ ] **Step 2: Derive entitlement + tier**

Immediately after the `const { session } = useAuth();` line, add:
```tsx
  const { isPro } = useEntitlement(session);
  const tier = tierOf(!!session, isPro);
  const anonymous = tier === "anonymous";
```

- [ ] **Step 3: Force Now while anonymous**

Add this effect right after the existing `loadBirth` effect:
```tsx
  // Anonymous users only get the Now view.
  useEffect(() => {
    if (anonymous) clock.setMode("now");
  }, [anonymous, clock.setMode]);
```

- [ ] **Step 4: Make the Big Three live (Sun+Moon) when anonymous**

Replace the `bigThree` memo:
```tsx
  const bigThree = useMemo(() => {
    const asc = ascendant(new Date(birthMs), birth.lat, birth.lon);
    return `☉ ${signOf(natalPos.sun)}   ☽ ${signOf(natalPos.moon)}   ↑ ${signOf(asc)}`;
  }, [birthMs, birth.lat, birth.lon, natalPos]);
```
with:
```tsx
  const bigThree = useMemo(() => {
    if (anonymous) {
      // Pre-birth placeholder: the current sky's Sun + Moon, tracking the Now moment.
      // No Ascendant — it needs a birth time + place, which unlocks on sign-in.
      return `☉ ${signOf(livePos.sun)}   ☽ ${signOf(livePos.moon)}`;
    }
    const asc = ascendant(new Date(birthMs), birth.lat, birth.lon);
    return `☉ ${signOf(natalPos.sun)}   ☽ ${signOf(natalPos.moon)}   ↑ ${signOf(asc)}`;
  }, [anonymous, livePos, birthMs, birth.lat, birth.lon, natalPos]);
```

- [ ] **Step 5: Hide the natal layer + show the sign-in prompt in the stage**

Replace the non-compare stage block:
```tsx
        <View style={styles.stage}>
          <Text style={styles.moment}>{moment}</Text>
          <Text style={styles.bigThree}>{bigThree}</Text>
          <View style={[styles.wheelBox, { width: wheelSize, height: wheelSize }]}>
            {fontsLoaded
              ? <ChartWheel natalPositions={natalPos} livePositions={livePos} showMajor={showMajor} showMinor={showMinor} vis={vis} />
              : <Text style={styles.note}>loading…</Text>}
          </View>
        </View>
```
with:
```tsx
        <View style={styles.stage}>
          <Text style={styles.moment}>{moment}</Text>
          <Text style={styles.bigThree}>{bigThree}</Text>
          <View style={[styles.wheelBox, { width: wheelSize, height: wheelSize }]}>
            {fontsLoaded
              ? <ChartWheel natalPositions={natalPos} livePositions={livePos} showMajor={showMajor} showMinor={showMinor} vis={vis} showNatal={!anonymous} />
              : <Text style={styles.note}>loading…</Text>}
          </View>
          {anonymous ? <SignInPrompt onPress={() => setAuthView("login")} /> : null}
        </View>
```

- [ ] **Step 6: Only show the controls sheet when signed in; pass `isPro`**

Replace the `<BottomSheet …>…</BottomSheet>` block:
```tsx
      <BottomSheet onExpandedChange={setSheetExpanded}>
        <ChartControls
          clock={clock}
          timeFormat={timeFormat}
          onTimeFormat={setTimeFormat}
          themeMode={themeMode}
          onTheme={setThemeMode}
          showMajor={showMajor}
          onToggleMajor={() => setShowMajor((v) => !v)}
          showMinor={showMinor}
          onToggleMinor={() => setShowMinor((v) => !v)}
          vis={vis}
          onToggleVis={onToggleVis}
        />
      </BottomSheet>
```
with:
```tsx
      {session ? (
        <BottomSheet onExpandedChange={setSheetExpanded}>
          <ChartControls
            clock={clock}
            isPro={isPro}
            timeFormat={timeFormat}
            onTimeFormat={setTimeFormat}
            themeMode={themeMode}
            onTheme={setThemeMode}
            showMajor={showMajor}
            onToggleMajor={() => setShowMajor((v) => !v)}
            showMinor={showMinor}
            onToggleMinor={() => setShowMinor((v) => !v)}
            vis={vis}
            onToggleVis={onToggleVis}
          />
        </BottomSheet>
      ) : null}
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS. (`useEffect`, `useMemo` already imported; `livePos`, `signOf`, `setAuthView` already in scope.)

- [ ] **Step 8: Commit**
```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): 3-tier gate — anonymous Now placeholder, Free/Pro controls"
```

---

## Task 9: Full suite + manual QA

- [ ] **Step 1: Run the mobile unit suite + typecheck**

Run: `pnpm --filter @astro/mobile test && pnpm --filter @astro/mobile typecheck`
Expected: all tests PASS (entitlement tests + the existing suite); typecheck clean.

- [ ] **Step 2: Manual checklist (Android emulator / iOS)**

- [ ] **Signed out:** only the **Now** chart shows; **no controls sheet**; the wheel shows the **live sky with no natal layer**; the Big Three line reads **☉ <sign>  ☽ <sign>** (no ↑); a **"Sign in to chart your birth →"** pill appears; the avatar menu shows **only "Sign in"**.
- [ ] Leave it a moment / change the device clock across a Moon-sign boundary → the Big Three sign updates.
- [ ] **Sign in** (no subscription) → the controls sheet appears; **Birth + Now** switch freely; **Date / Range / Compare** show **🔒** and tapping opens **"Unlock more cool features with Pro!"**; the **Glyphs** section is locked → tapping opens the same sheet; **Clock / Theme / Aspects** work; the avatar menu now shows **Account + Edit birth details**; entering birth works and the Big Three becomes the **birth** ☉/☽/↑.
- [ ] **Sign out** → reverts to the anonymous Now placeholder.
- [ ] *(Optional, if you set a `subscriptions` row to `status='active'` with a future `current_period_end` for your user)* → Date/Range/Compare + Glyphs unlock.

- [ ] **Step 3: Final commit (if smoke test required tweaks)**
```bash
git add -A
git commit -m "test(mobile): sign-in gate + now-placeholder manual smoke verified"
```

---

## Done → next

The 3-tier gate is live: anonymous = live Now placeholder, Free = Birth+Now+free controls, Pro features locked behind a teaser. **Deferred next slice:** the subscription **purchase flow** (Google Play Billing vs web Stripe + store policy) and a real Subscribe CTA in `ProLockSheet`.
