# Dynamic Onboarding Walkthrough — Design Spec (MoveStar mobile)

**Date:** 2026-06-15 · **Branch:** (new, off `feat/mobile-theme-header` or `main`) · **Status:** approved, pending spec review

**Goal:** A first-run, animated walkthrough that orients a brand-new user to MoveStar's key features (real-time sky, birth chart, time-travel, compare, save-as-wallpaper) and funnels them toward creating an account — soft at the start, insistent at the end.

**Why:** Last open item from the closed-test tester report. New users currently land on the live "Now" wheel with zero guidance.

---

## Key constraint — the tier reality

On **first launch** a user is **anonymous** (`tier === "anonymous"`), which the app restricts to the **Now view only**: no bottom sheet, no view selector, no Date/Range/Compare (those require sign-in; Pro gates the time-travel modes). So the rich controls a tour would point at **do not exist on screen** for a new user. This rules out a coachmark/spotlight tour on first run and drives the **animated showcase carousel** approach: we *preview* features (with live/animated demos) rather than point at absent UI, and use the carousel as the sign-up funnel.

---

## Approach (locked)

**Animated showcase carousel** — a full-screen overlay of swipeable slides, each with a live/animated demo, bookended by sign-up prompts. (Coachmarks-on-real-UI and a post-sign-in mini-tour are explicitly **out of scope** for v1 — see below.)

### Trigger & persistence
- **Shows** on first launch only — when the persisted flag `movestar.onboarding.v1` is absent/false — after the app is ready (fonts loaded).
- **Marked "seen"** (`saveOnboardingSeen()`) on **every** exit path (complete, skip, maybe-later-to-Now, or create-account), so it never auto-reshows.
- **Replayable** anytime from the ☰ menu → "How it works" (shows the overlay again without clearing the flag).
- **Skip** affordance on every slide → marks seen, dismisses to the anonymous Now view.

### Slides (5; horizontally paged, swipe + a Next button, progress dots)

| # | Title | Body | Demo | CTA(s) |
|---|---|---|---|---|
| 1 | Welcome to MoveStar | "Your living sky — the real planets, in real time." | the live wheel (subtle) | **Create free account** (primary) · **Maybe later** (→ slide 2) |
| 2 | The live sky | "Watch the actual planets move in real time." | real `ChartWheel`, ticking live | Next |
| 3 | Your birth chart | "Cast your birth chart — Sun, Moon & Rising — and save it as a wallpaper." | a natal wheel | Next |
| 4 | Go further | "Travel to any date, animate a date range, and compare two charts." *(Pro)* | planets sweeping across a date range + two compare wheels | Next |
| 5 | See your chart | "Want to see **your** birth chart with all these features? Create an account." | natal wheel / celestial flourish | **Create account** (primary) · **Continue to the live sky** (small, secondary → anonymous Now) |

### Sign-up funnel
- **Soft at slide 1:** "Create free account" available, but **Maybe later** simply advances the walkthrough — no gating.
- **Insistent at slide 5:** the primary action is **Create account** with a benefit-driven line; the opt-out ("Continue to the live sky") is present but visually secondary.
- **Any "Create account"** → marks seen, dismisses the overlay, and opens the existing auth flow (`setAuthView("login")`, which offers sign-up). No new auth UI.

### Dynamic content (the "dynamic" in the brief)
Demos reuse the real `ChartWheel` so the walkthrough shows the actual product, not mock art:
- **Slide 2** renders a small live wheel driven by the real clock (ticking).
- **Slide 4** drives `positions(instant)` with a lightweight timer loop that sweeps an instant across a date range (planets visibly move), plus a static two-wheel Compare snapshot.
- **Slides 1, 3, 5** show a still natal/live wheel with a gentle enter animation (fade/scale).
- No new heavy dependencies (no Lottie); animation via React Native's built-in `Animated` + a timer that drives engine `positions()` for the time-travel sweep. (The plan picks the concrete API; the spec only requires "no new heavy deps".)

---

## Architecture (small, focused units)

```
apps/mobile/
  components/onboarding/
    OnboardingWalkthrough.tsx   # overlay container: Modal, paged slides, dots, Next/Skip, exit wiring
    OnboardingDemo.tsx          # per-slide animated wheel demo (kind: live | natal | timetravel | compare)
  lib/
    onboarding.ts               # SLIDES: pure data (id, title, body, demo kind, primaryCta, secondaryCta)
    onboardingStorage.ts        # loadOnboardingSeen / saveOnboardingSeen (AsyncStorage movestar.onboarding.v1)
```

- **`lib/onboarding.ts`** — exports `SLIDES` (the 5 slide definitions) and any small pure helpers. No React, no AsyncStorage → unit-testable.
- **`lib/onboardingStorage.ts`** — async load/save against AsyncStorage key `movestar.onboarding.v1`. Follows the `themeStorage`/`birthStore` pattern. The **pure parse** (string → boolean, default false) lives in a non-AsyncStorage-importing spot so `node --test` can cover it (mirror how `parseThemeMode` sits in `themeMode.ts`, not `themeStorage.ts`).
- **`OnboardingWalkthrough.tsx`** — props: `visible`, `onDismiss()` (→ anonymous Now), `onCreateAccount()`. Owns slide paging + the Skip/Next/CTA buttons. Calls `onCreateAccount`/`onDismiss`; the parent persists "seen".
- **`OnboardingDemo.tsx`** — props: `kind` + the data it needs (palette, positions); renders the appropriate animated `ChartWheel`. One component, switched by `kind`.

### App.tsx wiring
- New state `onboardingVisible`. On launch, `loadOnboardingSeen()` → if not seen (and fonts ready), set `onboardingVisible = true`.
- Render `<OnboardingWalkthrough visible={onboardingVisible} onDismiss={...} onCreateAccount={...} />` near the top of the overlay stack (above the chart, below nothing it needs to block).
  - `onDismiss` → `saveOnboardingSeen(); setOnboardingVisible(false);`
  - `onCreateAccount` → `saveOnboardingSeen(); setOnboardingVisible(false); setAuthView("login");`
- Add a `replayOnboarding` path: `HeaderMenu` gets a "How it works" item → `setMenuOpen(false); setOnboardingVisible(true);` (does not clear the flag).

### HeaderMenu.tsx
- Add one row, "How it works", wired to an `onReplayWalkthrough` prop. Matches the existing menu-row style.

---

## Persistence & error handling
- Mirror existing stores (best-effort): `loadOnboardingSeen()` returns `false` (→ show once) on read error; `saveOnboardingSeen()` swallows write errors (consistent with `birthStore`/`themeStorage`). A write failure at worst re-shows the walkthrough next launch — acceptable, not data loss.
- AsyncStorage value: the string `"1"` for seen (parse: `=== "1"` → true, else false). Single key, no schema/versioned object needed beyond the `.v1` suffix.

## Testing
This adds pure logic that the project's `node --test` harness can cover (no RTL/component harness, per convention):
- **`onboardingStorage` parse** — `"1"` → true; `null`/garbage/`"0"` → false.
- **`onboarding` slide config invariants** — exactly 5 slides; slide 1 and slide 5 each carry a sign-up (`createAccount`) CTA; every slide has a non-empty title/body and a valid `demo` kind from the allowed set.
- Components (`OnboardingWalkthrough`, `OnboardingDemo`) are not unit-tested (project convention); verified on the emulator.

## Out of scope (v1)
- Coachmark/spotlight tour on the real UI (the tier reality makes it a poor first-run fit).
- A separate **post-sign-in** mini-tour of the now-visible controls (good future enhancement — the "Hybrid" option).
- Localization (English only).
- A/B testing or analytics on funnel conversion.
- Changing the auth/sign-up screens themselves (reuse `LoginScreen` as-is).

## Dependencies & sequencing
- Independent of the screenshots work; can branch off `main` or stack on `feat/mobile-theme-header`.
- Reuses `ChartWheel`, the engine `positions()`, the auth flow (`setAuthView`), and the `HeaderMenu`/`BottomSheet` patterns — no new libraries.
