# Design Spec — Mobile sign-in quick wins

**Date:** 2026-06-14
**Status:** Approved (pending spec review)
**Branch (to create):** `feat/mobile-signin-quick-wins` off `main`
**Package:** `@astro/mobile` (`apps/mobile`)

## Context

The Google Play closed-test "Testers Community" report found **no bugs** but recommended
polish. From it we picked two quick wins, and the user added a third gating fix:

1. **Password visibility toggle** — password fields lack a show/hide affordance.
2. **"Rate MoveStar" button** — no in-app path to the store listing for a review.
3. **Gate "Save to Photos" for signed-out users** — an anonymous user can currently open
   the ☰ menu and save the chart; this must require sign-in/sign-up first.

All three are small, independent, and ship in one PR. **No new dependencies; no native
rebuild** (`react-native-svg` is already installed; Rate uses `Linking`; gating is policy +
JSX). The existing dev build loads these over Metro.

## Out of scope

- Native in-app-review prompt (`expo-store-review`) — explicitly rejected; an explicit
  "Rate" button deep-links to the store instead (Google's API is built for auto-prompts).
- Surfacing the Rate button anywhere beyond the Account sheet (e.g. HeaderMenu).
- iOS store URL is a placeholder TODO (iOS not launching yet — no Apple membership).
- Theme options and onboarding walkthrough (separate, larger efforts).

---

## Part A — Password visibility toggle

### Component

New shared component **`apps/mobile/components/auth/PasswordInput.tsx`** used in all 5
password fields (DRY). Wraps React Native `TextInput`:

- Holds local `visible` boolean, default `false` → `secureTextEntry={!visible}`.
- Renders the field with extra right padding plus a trailing tappable **eye / eye-off SVG
  icon** (`react-native-svg`), absolutely positioned at the right edge, colored from the
  palette (`p.textDim`).
- Pass-through props so each call site keeps current behavior: `value`, `onChangeText`,
  `placeholder`, `placeholderTextColor`, `autoCapitalize`, `style` (the existing
  `styles.input` is passed in so look is unchanged).
- A small inline `EyeIcon` (open/closed paths) component, ~20px, hit area ≥44px.
- Accessibility: toggle gets `accessibilityRole="button"` and
  `accessibilityLabel={visible ? "Hide password" : "Show password"}`.

Each field owns its own toggle state (component-local) — expected behavior. Confirm fields
get a toggle too, for consistency.

### Call sites (replace raw `TextInput` with `<PasswordInput .../>`)

- `components/auth/LoginScreen.tsx` — sign-in password (225–226); sign-up password (225–226)
  + confirm (231–232); reset new password (170–171) + confirm (173–174).
- `components/auth/AccountView.tsx` — change-password new (172–180) + confirm (181–189).

(Line numbers are from exploration on `main`; treat as approximate anchors.)

---

## Part B — "Rate MoveStar" button

### Pure logic (testable)

New **`apps/mobile/lib/rateApp.ts`** — no `react-native` import, so it's unit-testable with
the repo's `node --test` convention:

```ts
const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.movestar.app";
const IOS_URL = "https://apps.apple.com/app/movestar/idTODO"; // TODO: real App Store ID when iOS ships
export function storeUrl(os: string): string {
  return os === "ios" ? IOS_URL : ANDROID_URL;
}
```

### Wiring (AccountView)

Add a `<Pressable style={styles.action}>` row **"Rate MoveStar ⭐"** after "Change Password"
(before the status message). The side-effect uses the file's existing inline
`Linking.openURL(...).catch(setMsg)` pattern (same as "Delete Account or Data"):

```tsx
import { Platform } from "react-native"; // add to existing RN import
import { storeUrl } from "../../lib/rateApp";
// ...
<Pressable style={styles.action} onPress={() =>
  void Linking.openURL(storeUrl(Platform.OS)).catch(() =>
    setMsg("Couldn't open the Play Store. Search 'MoveStar' to leave a review."),
  )
}>
  <Text style={styles.actionText}>Rate MoveStar ⭐</Text>
</Pressable>
```

**Scope:** Account sheet is sign-in-gated, so anonymous users won't see it — matches the
testers' "in Settings" ask and keeps the PR tight.

---

## Part C — Gate "Save to Photos" for signed-out users

Follow the existing `exportPolicy` + `canShare` pattern (pure, testable, centralized).

### Policy (testable)

Add to **`apps/mobile/lib/exportPolicy.ts`**:

```ts
/** Save-to-Photos requires an account; anonymous users must sign in/up first. */
export function canSave(tier: Tier): boolean {
  return tier !== "anonymous";
}
```

### Plumbing

- `App.tsx` — import `canSave as canSaveFor` (matching the `canShareFor`/`canToggleLogoFor`
  alias convention) and pass `canSave={canSaveFor(tier)}` to `<HeaderMenu>`.
- `components/HeaderMenu.tsx` — add `canSave: boolean` to `Props`; wrap the divider (line 48)
  **and** the "Save to Photos" `splitWrap` (lines 50–68) in `canSave ? (…) : null`, mirroring
  how "Edit birth details" is already gated on `signedIn`.

### Result

- Signed-out (`anonymous`) ☰ menu shows only **"Sign in"** (the Save block and its leading
  divider disappear, no trailing divider).
- After sign-in (`free`/`pro`): "Edit birth details" + "Save to Photos" appear as today.
- This fully gates saving — the only entry point is `HeaderMenu`'s `onSave`.

---

## Testing

The mobile app tests **pure logic in `lib/*.test.ts` via `node --test`** (10 existing files);
there is **no React Native component test harness** (no jest/RTL), and we will **not** add one
(YAGNI for this bundle).

**Automated (pure logic):**
- `lib/rateApp.test.ts` (new) — `storeUrl("android")` → Play URL; `storeUrl("ios")` → iOS URL.
- `lib/exportPolicy.test.ts` (extend) — `canSave("anonymous")===false`, `canSave("free")===true`,
  `canSave("pro")===true`.
- Run: `pnpm --filter @astro/mobile test`.

**Manual (on emulator — dev loop is running):**
- Password toggle flips visibility + icon on sign-in, sign-up (incl. confirm), reset, and
  change-password fields.
- "Rate MoveStar ⭐" opens the Play Store listing; failure path shows the fallback message.
- ☰ menu: "Save to Photos" hidden when signed out, visible after sign-in; no stray divider.

## Risks / notes

- Eye-off SVG must render via `react-native-svg` (confirmed installed, used by the chart wheel).
- `PasswordInput` must not regress `autoCapitalize="none"` / `secureTextEntry` on any field.
- iOS store URL is a placeholder — acceptable; iOS isn't shipping yet.
