# Mobile Sign-in Quick Wins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a password show/hide toggle, a "Rate MoveStar" button, and gate "Save to Photos" behind sign-in — three small polish items from the tester feedback, in one PR.

**Architecture:** Pure, testable logic lives in `lib/` (unit-tested with `node --test`, the repo convention); UI changes are thin and verified manually on the emulator. The password toggle is a single reusable `PasswordInput` swapped into all six secure fields. Save-gating extends the existing `exportPolicy` (`canSave(tier)`) and flows into `HeaderMenu` exactly like `canShare`.

**Tech Stack:** React Native + Expo (`@astro/mobile`), TypeScript, `react-native-svg` (already installed), `node --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-06-14-mobile-signin-quick-wins-design.md`

**Branch:** `feat/mobile-signin-quick-wins` (already created off `main`).

**Run all mobile unit tests:** `pnpm --filter @astro/mobile test`

---

## File Structure

**Create:**
- `apps/mobile/components/auth/PasswordInput.tsx` — reusable secure field + eye toggle (incl. inline `EyeIcon`).
- `apps/mobile/lib/rateApp.ts` — pure `storeUrl(os)` helper (no react-native import).
- `apps/mobile/lib/rateApp.test.ts` — unit tests for `storeUrl`.

**Modify:**
- `apps/mobile/lib/exportPolicy.ts` — add `canSave(tier)`.
- `apps/mobile/lib/exportPolicy.test.ts` — add `canSave` tests.
- `apps/mobile/components/HeaderMenu.tsx` — add `canSave` prop; gate the Save-to-Photos block.
- `apps/mobile/App.tsx` — import `canSave as canSaveFor`; pass `canSave={canSaveFor(tier)}`.
- `apps/mobile/components/auth/LoginScreen.tsx` — swap 4 secure `TextInput`s → `PasswordInput`.
- `apps/mobile/components/auth/AccountView.tsx` — swap 2 secure `TextInput`s → `PasswordInput`; add Platform + storeUrl imports; add "Rate MoveStar" row.

---

## Task 1: `canSave` export policy (Part C logic)

**Files:**
- Modify: `apps/mobile/lib/exportPolicy.ts`
- Test: `apps/mobile/lib/exportPolicy.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `apps/mobile/lib/exportPolicy.test.ts`:

```ts
import { canShare, canToggleLogo, showLogo, canSave } from "./exportPolicy.ts";

test("canSave: requires an account (free/pro), not anonymous", () => {
  assert.equal(canSave("anonymous"), false);
  assert.equal(canSave("free"), true);
  assert.equal(canSave("pro"), true);
});
```

(Replace the existing `import { canShare, canToggleLogo, showLogo } from "./exportPolicy.ts";` line with the one above so `canSave` is imported; the new `test(...)` block goes after the existing tests.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @astro/mobile exec node --test --experimental-strip-types lib/exportPolicy.test.ts`
Expected: FAIL — `canSave` is `undefined` / not exported.

- [ ] **Step 3: Implement `canSave`**

Append to `apps/mobile/lib/exportPolicy.ts`:

```ts
/** Save-to-Photos requires an account; anonymous users must sign in/up first. */
export function canSave(tier: Tier): boolean {
  return tier !== "anonymous";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @astro/mobile exec node --test --experimental-strip-types lib/exportPolicy.test.ts`
Expected: PASS (all `exportPolicy` tests, including the 3 new `canSave` assertions).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/exportPolicy.ts apps/mobile/lib/exportPolicy.test.ts
git commit -m "feat(mobile): add canSave export policy (anon cannot save)"
```

---

## Task 2: Gate "Save to Photos" in the header menu (Part C wiring)

**Files:**
- Modify: `apps/mobile/components/HeaderMenu.tsx` (Props + JSX)
- Modify: `apps/mobile/App.tsx` (import + prop)

No unit test (presentational); verified on the emulator in Step 4.

- [ ] **Step 1: Add the `canSave` prop to HeaderMenu**

In `apps/mobile/components/HeaderMenu.tsx`, add `canSave` to the `Props` interface (just after `canShare`):

```ts
  canShare: boolean;            // Pro-only: show the Share item
  canSave: boolean;             // signed-in only: show the Save-to-Photos item
```

And add it to the destructured params:

```ts
export function HeaderMenu({
  visible, signedIn, canShare, canSave, onClose, onAuth, onEditBirth, onSave, onShare,
  exportSettings, onToggleExport, canToggleLogo,
}: Props) {
```

- [ ] **Step 2: Gate the Save-to-Photos block**

In the same file, wrap the divider + split button in a `canSave` conditional. Replace this block:

```tsx
        <View style={styles.divider} />
        {/* Split "Save to Photos" button; the caret opens a floating options dropdown. */}
        <View style={styles.splitWrap}>
          <View style={styles.splitRow} onLayout={(e) => setRowH(e.nativeEvent.layout.height)}>
            <Pressable style={styles.splitMain} onPress={onSave}>
              <Text style={styles.itemText}>Save to Photos</Text>
            </Pressable>
            <Pressable style={styles.splitCaret} onPress={() => setOptionsOpen((o) => !o)} hitSlop={6}>
              <Text style={styles.caretText}>{optionsOpen ? "⌃" : "⌄"}</Text>
            </Pressable>
          </View>
          {optionsOpen ? (
            <View style={[styles.popover, { top: rowH + 4 }]}>
              <ExportOption label="Date" on={exportSettings.dateTime} onPress={() => onToggleExport("dateTime")} />
              <ExportOption label="Stars" on={exportSettings.cosmicBackground} onPress={() => onToggleExport("cosmicBackground")} />
              {canToggleLogo ? (
                <ExportOption label="Logo" on={exportSettings.logo} onPress={() => onToggleExport("logo")} />
              ) : null}
            </View>
          ) : null}
        </View>
```

with the same block wrapped in `{canSave ? ( <> … </> ) : null}`:

```tsx
        {canSave ? (
          <>
            <View style={styles.divider} />
            {/* Split "Save to Photos" button; the caret opens a floating options dropdown. */}
            <View style={styles.splitWrap}>
              <View style={styles.splitRow} onLayout={(e) => setRowH(e.nativeEvent.layout.height)}>
                <Pressable style={styles.splitMain} onPress={onSave}>
                  <Text style={styles.itemText}>Save to Photos</Text>
                </Pressable>
                <Pressable style={styles.splitCaret} onPress={() => setOptionsOpen((o) => !o)} hitSlop={6}>
                  <Text style={styles.caretText}>{optionsOpen ? "⌃" : "⌄"}</Text>
                </Pressable>
              </View>
              {optionsOpen ? (
                <View style={[styles.popover, { top: rowH + 4 }]}>
                  <ExportOption label="Date" on={exportSettings.dateTime} onPress={() => onToggleExport("dateTime")} />
                  <ExportOption label="Stars" on={exportSettings.cosmicBackground} onPress={() => onToggleExport("cosmicBackground")} />
                  {canToggleLogo ? (
                    <ExportOption label="Logo" on={exportSettings.logo} onPress={() => onToggleExport("logo")} />
                  ) : null}
                </View>
              ) : null}
            </View>
          </>
        ) : null}
```

- [ ] **Step 3: Pass `canSave` from App.tsx**

In `apps/mobile/App.tsx`:

1. Add `canSave as canSaveFor` to the existing `./lib/exportPolicy` import (which already imports `canShare as canShareFor` and `canToggleLogo as canToggleLogoFor`).
2. In the `<HeaderMenu .../>` element, add the prop next to `canToggleLogo={canToggleLogoFor(tier)}`:

```tsx
        canSave={canSaveFor(tier)}
```

- [ ] **Step 4: Verify on the emulator**

Reload the app (Metro is running). Metro must bundle with **no TypeScript errors** (a missing `canSave` prop would error).
- While **signed out**: open the ☰ menu (top-right) → it shows only **"Sign in"** (no "Save to Photos", no stray divider).
- **Sign in**, reopen ☰ → "Edit birth details" and "Save to Photos" appear as before.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/HeaderMenu.tsx apps/mobile/App.tsx
git commit -m "feat(mobile): hide Save to Photos for signed-out users"
```

---

## Task 3: `storeUrl` helper (Part B logic)

**Files:**
- Create: `apps/mobile/lib/rateApp.ts`
- Test: `apps/mobile/lib/rateApp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/lib/rateApp.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeUrl } from "./rateApp.ts";

test("storeUrl: android -> Play Store listing", () => {
  assert.equal(
    storeUrl("android"),
    "https://play.google.com/store/apps/details?id=com.movestar.app",
  );
});

test("storeUrl: ios -> App Store listing", () => {
  assert.match(storeUrl("ios"), /^https:\/\/apps\.apple\.com\/app\/movestar\//);
});

test("storeUrl: unknown os defaults to Play Store", () => {
  assert.equal(
    storeUrl("web"),
    "https://play.google.com/store/apps/details?id=com.movestar.app",
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @astro/mobile exec node --test --experimental-strip-types lib/rateApp.test.ts`
Expected: FAIL — cannot find module `./rateApp.ts`.

- [ ] **Step 3: Implement `storeUrl`**

Create `apps/mobile/lib/rateApp.ts`:

```ts
/** Store-listing URLs for the in-app "Rate MoveStar" button. Pure (no react-native
 *  import) so it is unit-testable with `node --test`. The caller opens it via Linking. */
const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.movestar.app";
// TODO: replace `idTODO` with the real App Store ID once iOS ships.
const IOS_URL = "https://apps.apple.com/app/movestar/idTODO";

export function storeUrl(os: string): string {
  return os === "ios" ? IOS_URL : ANDROID_URL;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @astro/mobile exec node --test --experimental-strip-types lib/rateApp.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/rateApp.ts apps/mobile/lib/rateApp.test.ts
git commit -m "feat(mobile): add storeUrl helper for Rate button"
```

---

## Task 4: "Rate MoveStar" button in AccountView (Part B wiring)

**Files:**
- Modify: `apps/mobile/components/auth/AccountView.tsx`

No unit test (presentational + side-effect); verified on the emulator in Step 4.

- [ ] **Step 1: Add imports**

In `apps/mobile/components/auth/AccountView.tsx`:

1. Add `Platform` to the existing react-native import:

```ts
import { Modal, View, Text, Pressable, StyleSheet, TextInput, Keyboard, Linking, Platform } from "react-native";
```

2. Add the `storeUrl` import (next to the other `../../lib/...` imports):

```ts
import { storeUrl } from "../../lib/rateApp";
```

- [ ] **Step 2: Add the Rate button row**

On the **main account screen**, immediately after the "Change Password" pressable:

```tsx
              <Pressable style={styles.action} onPress={openPassword}>
                <Text style={styles.actionText}>Change Password</Text>
              </Pressable>
```

insert:

```tsx
              <Pressable
                style={styles.action}
                onPress={() =>
                  void Linking.openURL(storeUrl(Platform.OS)).catch(() =>
                    setMsg("Couldn't open the Play Store. Search 'MoveStar' to leave a review."),
                  )
                }
              >
                <Text style={styles.actionText}>Rate MoveStar ⭐</Text>
              </Pressable>
```

(`styles.action` / `styles.actionText` / `setMsg` already exist in this file; this mirrors the existing "Delete Account or Data" `Linking.openURL(...).catch(setMsg)` pattern.)

- [ ] **Step 3: Verify it builds**

Reload the app — Metro must bundle with no errors. (`Platform.OS` typing and the new import resolve cleanly.)

- [ ] **Step 4: Verify on the emulator**

Sign in → open Account (☰ → Account). A **"Rate MoveStar ⭐"** row appears after "Change Password". Tapping it opens the Play Store listing for `com.movestar.app` in the browser/Play app. (On this emulator the Play Store may show "item not found" since the app isn't published to this account — that's fine; the key check is that it navigates to the correct listing URL.)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/auth/AccountView.tsx
git commit -m "feat(mobile): add Rate MoveStar button to Account sheet"
```

---

## Task 5: `PasswordInput` component (Part A)

**Files:**
- Create: `apps/mobile/components/auth/PasswordInput.tsx`

No component test harness exists (no jest/RTL); verified on the emulator in Task 6.

- [ ] **Step 1: Create the component**

Create `apps/mobile/components/auth/PasswordInput.tsx`:

```tsx
import { useMemo, useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle, TextInputProps } from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  style?: StyleProp<ViewStyle>;
};

/** Password field with a show/hide eye toggle. The caller's `style` (their `styles.input`)
 *  is applied to the bordered row; the TextInput is a flex child so the eye sits inside the
 *  box on the right. Defaults to hidden (secureTextEntry). */
export function PasswordInput({
  value, onChangeText, placeholder, placeholderTextColor, autoCapitalize = "none", style,
}: Props) {
  const { palette: p } = useTheme();
  const s = useMemo(() => makeStyles(p), [p]);
  const [visible, setVisible] = useState(false);
  return (
    <View style={[style, s.row]}>
      <TextInput
        style={s.field}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        secureTextEntry={!visible}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        style={s.toggle}
      >
        <EyeIcon crossed={visible} color={p.textDim} />
      </Pressable>
    </View>
  );
}

/** Feather-style eye; a diagonal slash is added when `crossed` (password currently visible). */
function EyeIcon({ crossed, color }: { crossed: boolean; color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <Circle cx={12} cy={12} r={3} />
      {crossed ? <Line x1={3} y1={3} x2={21} y2={21} /> : null}
    </Svg>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  // `style` (styles.input) supplies the border/background/padding; row lays out field + eye.
  row: { flexDirection: "row", alignItems: "center" },
  // Field re-declares text color/size (a View ignores them) and clears default padding.
  field: { flex: 1, padding: 0, color: p.text, fontSize: 16 },
  toggle: { paddingLeft: 10 },
});
```

- [ ] **Step 2: Verify it builds**

Reload the app — Metro must bundle with no errors (no usages yet; this just confirms the new module + `react-native-svg` import compile).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/auth/PasswordInput.tsx
git commit -m "feat(mobile): add PasswordInput with eye/eye-off toggle"
```

---

## Task 6: Swap `PasswordInput` into all secure fields (Part A wiring)

**Files:**
- Modify: `apps/mobile/components/auth/LoginScreen.tsx` (4 secure fields)
- Modify: `apps/mobile/components/auth/AccountView.tsx` (2 secure fields)

No unit test (presentational); verified on the emulator in Step 4.

- [ ] **Step 1: Import PasswordInput in both files**

In `apps/mobile/components/auth/LoginScreen.tsx` and `apps/mobile/components/auth/AccountView.tsx`, add:

```ts
import { PasswordInput } from "./PasswordInput";
```

- [ ] **Step 2: Replace the 4 secure fields in LoginScreen.tsx**

There are two identical secure password inputs (`value={password}`) and two identical confirm inputs (`value={confirm}`) — one of each in the reset flow and one of each in the sign-in/sign-up flow. Replace **every** occurrence of:

```tsx
                    <TextInput style={styles.input} value={password} onChangeText={setPassword}
                      placeholder="••••••••" placeholderTextColor={p.textDim} secureTextEntry />
```

with:

```tsx
                    <PasswordInput style={styles.input} value={password} onChangeText={setPassword}
                      placeholder="••••••••" placeholderTextColor={p.textDim} />
```

and **every** occurrence of:

```tsx
                    <TextInput style={styles.input} value={confirm} onChangeText={setConfirm}
                      placeholder="••••••••" placeholderTextColor={p.textDim} secureTextEntry />
```

with:

```tsx
                    <PasswordInput style={styles.input} value={confirm} onChangeText={setConfirm}
                      placeholder="••••••••" placeholderTextColor={p.textDim} />
```

(Note: indentation differs between the reset block and the sign-in block; match each occurrence's existing indentation. Only the `<TextInput …secureTextEntry />` password/confirm fields change — leave the email/name/code `TextInput`s untouched.)

- [ ] **Step 3: Replace the 2 secure fields in AccountView.tsx**

Replace:

```tsx
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor={p.textDim}
                secureTextEntry
                autoCapitalize="none"
                value={newPw}
                onChangeText={setNewPw}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor={p.textDim}
                secureTextEntry
                autoCapitalize="none"
                value={confirmPw}
                onChangeText={setConfirmPw}
              />
```

with:

```tsx
              <PasswordInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor={p.textDim}
                autoCapitalize="none"
                value={newPw}
                onChangeText={setNewPw}
              />
              <PasswordInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor={p.textDim}
                autoCapitalize="none"
                value={confirmPw}
                onChangeText={setConfirmPw}
              />
```

- [ ] **Step 4: Verify on the emulator**

Reload the app (must bundle clean). Check each field shows an eye icon inside the box on the right, and tapping it reveals/hides the text and toggles the slash:
- **Sign in**: Password field.
- **Create account**: Password + Confirm password.
- **Reset password** (Forgot password → after code): New password + Confirm new password.
- **Account → Change Password** (sign in first): New password + Confirm password.

Confirm the box border/height/spacing looks unchanged vs. before (the eye sits inside the existing border). If the eye crowds the text, increase `toggle.paddingLeft` in `PasswordInput.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/auth/LoginScreen.tsx apps/mobile/components/auth/AccountView.tsx
git commit -m "feat(mobile): use PasswordInput for all password fields"
```

---

## Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full mobile unit suite**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS — all existing `lib/*.test.ts` plus the new `canSave` and `storeUrl` tests.

- [ ] **Step 2: Full manual pass on the emulator**

With Metro running, verify end-to-end:
1. Signed out: ☰ menu shows only "Sign in" (no Save to Photos).
2. Password eye toggle works on all six fields (sign-in, sign-up ×2, reset ×2, change-password ×2).
3. Signed in: ☰ shows Save to Photos again; Account sheet shows "Rate MoveStar ⭐" which opens the store listing.

- [ ] **Step 3: Confirm clean git state**

Run: `git status` — only intended files changed; `git log --oneline -7` shows the feature commits on `feat/mobile-signin-quick-wins`.

---

## Self-Review (completed by plan author)

- **Spec coverage:** Part A → Tasks 5–6; Part B → Tasks 3–4; Part C → Tasks 1–2; testing → Tasks 1, 3, 7. All spec sections mapped.
- **Placeholders:** Only the intentional `idTODO` iOS App Store ID (flagged in spec as acceptable; iOS not shipping). No TBD/vague steps.
- **Type consistency:** `canSave(tier: Tier)` used identically in `exportPolicy.ts`, its test, and `App.tsx` (`canSaveFor`); `storeUrl(os: string)` identical in helper, test, and AccountView call; `PasswordInput` prop names (`value`, `onChangeText`, `placeholder`, `placeholderTextColor`, `autoCapitalize`, `style`) match every call site.
