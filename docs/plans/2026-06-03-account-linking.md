# Account Linking (same email → one user) + Apple Sign-In — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make email/password + Google + Apple sign-in on the same email resolve to one Supabase user — by adding native Apple Sign-In (iOS only), graceful "already exists" messaging, a confirm-password field, and a one-time migration that merges any pre-launch duplicate users.

**Architecture:** Linking itself is Supabase's built-in automatic identity linking (matching + verified email) — we add no linking code; we add the providers and UX around it. New pure modules (`authResult.ts`, `appleAuth.ts`, a `passwordsMatch` helper) hold the logic so it is unit-testable under the mobile `node --test` runner; `auth.tsx` does the native Apple call and `signInWithIdToken`; `LoginScreen.tsx` gains the iOS-gated Apple button, the confirm-password field, and the messaging. A single idempotent SQL migration cleans up pre-launch duplicates.

**Tech Stack:** Expo SDK 54 / React Native 0.81 / React 19, `@supabase/supabase-js` v2, `expo-apple-authentication`, Supabase Postgres migrations. Tests: `node --test --experimental-strip-types "lib/*.test.ts"` (pure TS only — no RN/native imports load under this runner).

**Spec:** `docs/specs/2026-06-03-account-linking-design.md`.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/mobile/package.json` | add `expo-apple-authentication` (via `expo install`) |
| `apps/mobile/app.json` | add `expo-apple-authentication` plugin + `ios.usesAppleSignIn: true` |
| `apps/mobile/lib/password.ts` (+ `.test.ts`) | add pure `passwordsMatch(a, b)` (TDD) |
| `apps/mobile/lib/authResult.ts` (+ `.test.ts`) | pure `interpretSignUp(data)` classifier (TDD) |
| `apps/mobile/lib/appleAuth.ts` (+ `.test.ts`) | pure Apple helpers — `buildAppleIdTokenParams`, `appleFullNameToString`, `isAppleCancel` (TDD) |
| `apps/mobile/lib/auth.tsx` | `AuthResult.alreadyExists`; `signUp` via `interpretSignUp`; new `signInWithApple` (native calls + `updateUser` name capture) |
| `apps/mobile/components/auth/LoginScreen.tsx` | iOS-gated Apple button, confirm-password field, "already exists" + sign-in-fail messaging |
| `supabase/migrations/20260603000000_merge_duplicate_users.sql` | one-time idempotent duplicate-user merge |

**Out of this slice (spec §11):** Apple on the web app; add-password flow for OAuth-only accounts; runtime merge tool; password reset; native Google SDK; merging real (post-launch) duplicates.

---

## Task 1: Add Apple auth dependency + iOS config

**Files:**
- Modify: `apps/mobile/package.json` (via `expo install`)
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Install `expo-apple-authentication` (Expo picks the SDK-54-compatible version)**

Run:
```bash
cd apps/mobile && npx expo install expo-apple-authentication
```
Expected: `package.json` gains `"expo-apple-authentication"` in `dependencies`; the lockfile updates.

- [ ] **Step 2: Register the config plugin + enable the iOS entitlement in `app.json`**

In `apps/mobile/app.json`, add `"usesAppleSignIn": true` inside the `"ios"` object (sibling of `"bundleIdentifier"`), and add `"expo-apple-authentication"` to the `"plugins"` array. The result:
```json
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.movestar.app",
      "usesAppleSignIn": true
    },
```
```json
    "plugins": [
      "expo-font",
      "@react-native-community/datetimepicker",
      "expo-web-browser",
      "expo-apple-authentication"
    ]
```

- [ ] **Step 3: Typecheck (sanity — no code uses the module yet)**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json pnpm-lock.yaml
git commit -m "chore(mobile): add expo-apple-authentication dep + iOS Sign-in-with-Apple config"
```

> Note: the Apple **provider** config (Apple Developer App ID/Services ID/key, Supabase Apple provider, dev build) is user setup — spec §9. The button stays hidden until a dev build with the entitlement runs on iOS.

---

## Task 2: `passwordsMatch` helper (TDD)

Pure addition to the existing `apps/mobile/lib/password.ts`. Gates the new confirm-password field.

**Files:**
- Modify: `apps/mobile/lib/password.ts`
- Test: `apps/mobile/lib/password.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/mobile/lib/password.test.ts` (create it if absent — if creating, prepend the two `import` lines shown):
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordsMatch } from "./password.ts";

test("passwordsMatch: equal non-empty passwords match", () => {
  assert.equal(passwordsMatch("abcd1234", "abcd1234"), true);
});

test("passwordsMatch: differing passwords do not match", () => {
  assert.equal(passwordsMatch("abcd1234", "abcd9999"), false);
});

test("passwordsMatch: empty inputs never match (don't enable submit on empty)", () => {
  assert.equal(passwordsMatch("", ""), false);
  assert.equal(passwordsMatch("abcd1234", ""), false);
  assert.equal(passwordsMatch("", "abcd1234"), false);
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `pnpm --filter @astro/mobile test`
Expected: FAIL — `passwordsMatch` is not exported from `./password.ts`.

- [ ] **Step 3: Add the implementation to `apps/mobile/lib/password.ts`**

Append below `validatePassword`:
```ts
/** True only when both fields are non-empty and identical. Pure; used by the signup form's
 *  confirm-password gate (client-side UX — Supabase only stores one password). */
export function passwordsMatch(password: string, confirm: string): boolean {
  return password.length > 0 && password === confirm;
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS (the new tests + the existing suite stay green).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/password.ts apps/mobile/lib/password.test.ts
git commit -m "feat(mobile): passwordsMatch helper for signup confirm field"
```

---

## Task 3: `interpretSignUp` classifier (TDD)

Pure module that classifies a `supabase.auth.signUp` response. With email confirmation ON, an already-registered email is obfuscated as a fake user with an **empty `identities` array** and no session (anti-enumeration); a genuinely new account has ≥1 identity and no session; a session present means success.

**Files:**
- Create: `apps/mobile/lib/authResult.ts`
- Test: `apps/mobile/lib/authResult.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/lib/authResult.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretSignUp } from "./authResult.ts";

test("interpretSignUp: empty identities + no session → already_exists", () => {
  assert.equal(
    interpretSignUp({ user: { identities: [] }, session: null }),
    "already_exists",
  );
});

test("interpretSignUp: one identity + no session → needs_confirm", () => {
  assert.equal(
    interpretSignUp({ user: { identities: [{ id: "x" }] }, session: null }),
    "needs_confirm",
  );
});

test("interpretSignUp: session present → success", () => {
  assert.equal(
    interpretSignUp({ user: { identities: [{ id: "x" }] }, session: { access_token: "t" } }),
    "success",
  );
});

test("interpretSignUp: null user + no session → needs_confirm (safe default)", () => {
  assert.equal(interpretSignUp({ user: null, session: null }), "needs_confirm");
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `pnpm --filter @astro/mobile test`
Expected: FAIL — `Cannot find module './authResult.ts'`.

- [ ] **Step 3: Implement `apps/mobile/lib/authResult.ts`**

```ts
/** The subset of `supabase.auth.signUp`'s `data` we need to classify the outcome. Kept as a
 *  minimal structural type so this module is pure and testable under `node --test`. */
export interface SignUpData {
  user: { identities?: unknown[] | null } | null;
  session: unknown | null;
}

export type SignUpOutcome = "success" | "needs_confirm" | "already_exists";

/** Classify a (non-error) signUp response.
 *  - session present                → "success" (confirmation off, or already confirmed)
 *  - user with EMPTY identities[]    → "already_exists" (Supabase anti-enumeration obfuscation
 *                                       when email confirmation is ON — see spec §3.3)
 *  - otherwise                       → "needs_confirm" (new account awaiting the email link) */
export function interpretSignUp(data: SignUpData): SignUpOutcome {
  if (data.session) return "success";
  const identities = data.user?.identities;
  if (Array.isArray(identities) && identities.length === 0) return "already_exists";
  return "needs_confirm";
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/authResult.ts apps/mobile/lib/authResult.test.ts
git commit -m "feat(mobile): interpretSignUp classifier (detect already-registered email)"
```

---

## Task 4: Apple helpers (TDD)

Pure helpers used by `auth.tsx`'s `signInWithApple`. They use a **local** credential type (no `expo-apple-authentication` import) so they load under `node --test`.

**Files:**
- Create: `apps/mobile/lib/appleAuth.ts`
- Test: `apps/mobile/lib/appleAuth.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/lib/appleAuth.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAppleIdTokenParams, appleFullNameToString, isAppleCancel } from "./appleAuth.ts";

test("buildAppleIdTokenParams: token → provider+token args", () => {
  assert.deepEqual(buildAppleIdTokenParams("tok123"), { provider: "apple", token: "tok123" });
});

test("buildAppleIdTokenParams: missing token throws", () => {
  assert.throws(() => buildAppleIdTokenParams(null), /identity token/);
});

test("appleFullNameToString: joins given + family", () => {
  assert.equal(appleFullNameToString({ givenName: "Ada", familyName: "Lovelace" }), "Ada Lovelace");
});

test("appleFullNameToString: partial name keeps the present part", () => {
  assert.equal(appleFullNameToString({ givenName: "Ada", familyName: null }), "Ada");
});

test("appleFullNameToString: absent/empty name → null", () => {
  assert.equal(appleFullNameToString(null), null);
  assert.equal(appleFullNameToString({}), null);
  assert.equal(appleFullNameToString({ givenName: "  ", familyName: null }), null);
});

test("isAppleCancel: only the cancel code is a cancel", () => {
  assert.equal(isAppleCancel({ code: "ERR_REQUEST_CANCELED" }), true);
  assert.equal(isAppleCancel(new Error("boom")), false);
  assert.equal(isAppleCancel(null), false);
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `pnpm --filter @astro/mobile test`
Expected: FAIL — `Cannot find module './appleAuth.ts'`.

- [ ] **Step 3: Implement `apps/mobile/lib/appleAuth.ts`**

```ts
/** Minimal structural shape of the parts of an `expo-apple-authentication` credential we use.
 *  Declared locally (no native import) so this module stays pure and testable under node --test. */
export interface AppleCredentialLike {
  identityToken: string | null;
  fullName?: { givenName?: string | null; familyName?: string | null } | null;
}

/** Args for `supabase.auth.signInWithIdToken`. No nonce: the Expo flow relies on Apple-token
 *  signature verification (spec §3.2). */
export interface AppleIdTokenParams {
  provider: "apple";
  token: string;
}

/** Build the signInWithIdToken args; throw if Apple returned no identity token. */
export function buildAppleIdTokenParams(identityToken: string | null): AppleIdTokenParams {
  if (!identityToken) throw new Error("Apple sign-in did not return an identity token.");
  return { provider: "apple", token: identityToken };
}

/** Join Apple's first-authorization name parts into a display name, or null if absent/blank. */
export function appleFullNameToString(fullName: AppleCredentialLike["fullName"]): string | null {
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.familyName].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  return parts.length ? parts.join(" ") : null;
}

/** `expo-apple-authentication` throws this code when the user cancels the native sheet. */
export function isAppleCancel(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "ERR_REQUEST_CANCELED"
  );
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/appleAuth.ts apps/mobile/lib/appleAuth.test.ts
git commit -m "feat(mobile): pure Apple sign-in helpers (params, name, cancel)"
```

---

## Task 5: Wire Apple + already-exists into `auth.tsx`

Add `alreadyExists` to `AuthResult`, route `signUp` through `interpretSignUp`, and add `signInWithApple` (the only place that touches the native module + `signInWithIdToken` + `updateUser`).

**Files:**
- Modify: `apps/mobile/lib/auth.tsx`

- [ ] **Step 1: Add imports**

At the top of `apps/mobile/lib/auth.tsx`, after the existing `import { supabase } from "./supabase";` line, add:
```tsx
import * as AppleAuthentication from "expo-apple-authentication";
import { interpretSignUp } from "./authResult";
import { buildAppleIdTokenParams, appleFullNameToString, isAppleCancel } from "./appleAuth";
```

- [ ] **Step 2: Extend `AuthResult` and the `AuthValue` interface**

Replace the `AuthResult` interface (currently `error?`, `needsConfirm?`, `cancelled?`) with:
```tsx
export interface AuthResult {
  error?: string;
  needsConfirm?: boolean;
  cancelled?: boolean;
  alreadyExists?: boolean;
}
```
Then, in the `AuthValue` interface, add the Apple action right after the `signInWithGoogle` line:
```tsx
  signInWithApple: () => Promise<AuthResult>;
```

- [ ] **Step 3: Route `signUp` through `interpretSignUp`**

Replace the body of `signUp` after the error guard — replace this:
```tsx
    if (error) return { error: error.message };
    // With email confirmation ON, signUp returns no session until the link is clicked.
    return { needsConfirm: !data.session };
```
with:
```tsx
    if (error) return { error: error.message };
    // Classify the (obfuscated) response: already-registered emails come back with an empty
    // identities[] and no session; a new account has identities + no session (spec §3.3).
    const outcome = interpretSignUp(data);
    if (outcome === "already_exists") return { alreadyExists: true };
    if (outcome === "needs_confirm") return { needsConfirm: true };
    return {};
```

- [ ] **Step 4: Add `signInWithApple` (place it right after `signInWithGoogle`)**

```tsx
  async function signInWithApple(): Promise<AuthResult> {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { error } = await supabase.auth.signInWithIdToken(
        buildAppleIdTokenParams(credential.identityToken),
      );
      if (error) return { error: error.message };

      // Apple returns the name ONLY on the first authorization — capture it best-effort into
      // user_metadata.name (what AccountView reads). Must never fail the sign-in.
      const name = appleFullNameToString(credential.fullName);
      if (name) {
        try {
          await supabase.auth.updateUser({ data: { name } });
        } catch (e) {
          console.warn("Apple name capture failed (non-fatal):", e);
        }
      }
      return {};
    } catch (e) {
      if (isAppleCancel(e)) return { cancelled: true }; // user dismissed the sheet — not an error
      return { error: e instanceof Error ? e.message : "Apple sign-in failed." };
    }
  }
```

- [ ] **Step 5: Expose `signInWithApple` on the context value**

In the `<AuthContext.Provider value={{ … }}>`, add `signInWithApple` to the object (e.g. right after `signInWithGoogle`):
```tsx
      value={{ session, user: session?.user ?? null, loading, signUp, signIn, signInWithGoogle, signInWithApple, signOut }}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS. (If `expo-apple-authentication` types are missing, re-run Task 1 Step 1.)

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/auth.tsx
git commit -m "feat(mobile): signInWithApple + already-exists detection in auth provider"
```

---

## Task 6: Apple button + confirm-password + messaging in `LoginScreen.tsx`

Add the iOS-gated Apple button (official `AppleAuthenticationButton`, styled by theme), a confirm-password field in signup mode, the "already exists" handling, and a sign-in-failure OAuth hint.

**Files:**
- Modify: `apps/mobile/components/auth/LoginScreen.tsx`

- [ ] **Step 1: Add imports**

After the existing `import { validatePassword } from "../../lib/password";` line, add:
```tsx
import { useEffect } from "react";
import * as AppleAuthentication from "expo-apple-authentication";
import { passwordsMatch } from "../../lib/password";
```
(Leave the existing `import { useMemo, useState } from "react";` line as-is — `useEffect` is imported on its own line above.)

- [ ] **Step 2: Read `t` from the theme and add new state**

Change:
```tsx
  const { palette: p } = useTheme();
```
to:
```tsx
  const { palette: p, t } = useTheme();
```
Then, after the existing `const [busy, setBusy] = useState(false);` line, add:
```tsx
  const [confirm, setConfirm] = useState("");
  const [showOAuthHint, setShowOAuthHint] = useState(false);
  const [appleReady, setAppleReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => { if (active) setAppleReady(ok); })
      .catch(() => { if (active) setAppleReady(false); });
    return () => { active = false; };
  }, []);
```

- [ ] **Step 3: Reset the new state**

Replace `reset()` with:
```tsx
  function reset() {
    setName(""); setEmail(""); setPassword(""); setConfirm("");
    setError(null); setInfo(null); setBusy(false); setShowOAuthHint(false);
  }
```

- [ ] **Step 4: Pull `signInWithApple` from the hook**

Change:
```tsx
  const { signIn, signUp, signInWithGoogle } = useAuth();
```
to:
```tsx
  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();
```

- [ ] **Step 5: Update `onSubmit` (signup → handle `alreadyExists`; signin → set the hint)**

Replace the whole `onSubmit` function with:
```tsx
  async function onSubmit() {
    setError(null); setInfo(null); setShowOAuthHint(false);
    if (mode === "signup") {
      if (!pw.ok) { setError(`Password needs ${pw.problems.join(", ")}.`); return; }
      if (!passwordsMatch(password, confirm)) { setError("Passwords don't match."); return; }
      setBusy(true);
      const r = await signUp(email.trim(), password, name.trim());
      setBusy(false);
      if (r.error) { setError(r.error); return; }
      if (r.alreadyExists) {
        setMode("signin");
        setPassword(""); setConfirm("");
        setError("An account with this email already exists. Sign in below — if you first used Google or Apple, use those buttons above.");
        return;
      }
      if (r.needsConfirm) {
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
        setPassword(""); setConfirm("");
        return;
      }
      close(); // confirmation off → session active → done
      return;
    }
    setBusy(true);
    const r = await signIn(email.trim(), password);
    setBusy(false);
    if (r.error) { setError(r.error); setShowOAuthHint(true); return; }
    close();
  }
```

- [ ] **Step 6: Add the Apple handler (after `onGoogle`)**

```tsx
  async function onApple() {
    setError(null); setInfo(null); setShowOAuthHint(false); setBusy(true);
    const r = await signInWithApple();
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    if (r.cancelled) return; // sheet dismissed — keep the login sheet open
    close();
  }
```

- [ ] **Step 7: Update `submitDisabled` to require the confirm match in signup mode**

Replace:
```tsx
  const submitDisabled = busy || !email.trim() || !password || (mode === "signup" && !pw.ok);
```
with:
```tsx
  const submitDisabled =
    busy || !email.trim() || !password ||
    (mode === "signup" && (!pw.ok || !passwordsMatch(password, confirm)));
```

- [ ] **Step 8: Render the Apple button (above the Google button)**

Inside the `<ScrollView …>`, immediately **before** the existing `<Pressable style={styles.google} …>`, add:
```tsx
            {appleReady && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={
                  t < 0.5
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={10}
                style={styles.apple}
                onPress={onApple}
              />
            )}
```

- [ ] **Step 9: Render the confirm-password field + mismatch hint (after the password field block)**

Immediately **after** the password `<TextInput … secureTextEntry />` (and before the existing `{mode === "signup" && password.length > 0 && !pw.ok && (…)}` hint), add:
```tsx
            {mode === "signup" && (
              <>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput style={styles.input} value={confirm} onChangeText={setConfirm}
                  placeholder="••••••••" placeholderTextColor={p.textDim} secureTextEntry />
                {confirm.length > 0 && confirm !== password && (
                  <Text style={styles.hint}>Passwords don't match.</Text>
                )}
              </>
            )}
```

- [ ] **Step 10: Render the sign-in OAuth hint (after the error/info lines)**

Immediately **after** the `{info ? <Text style={styles.ok}>{info}</Text> : null}` line, add:
```tsx
            {mode === "signin" && showOAuthHint && (
              <Text style={styles.hint}>Used Google or Apple before? Use the buttons above.</Text>
            )}
```

- [ ] **Step 11: Add the `apple` style**

In the `makeStyles` `StyleSheet.create({…})`, add (next to `google`):
```tsx
  apple: { height: 48, marginBottom: 10 },
```

- [ ] **Step 12: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add apps/mobile/components/auth/LoginScreen.tsx
git commit -m "feat(mobile): Apple button (iOS), confirm-password field, already-exists messaging"
```

---

## Task 7: One-time duplicate-user merge migration

A single idempotent migration that merges pre-launch `auth.users` sharing an email. Canonical = earliest `created_at` (tie-break lowest `id`); re-points `birth_charts`/`subscriptions`/`profiles`, preserves exactly one primary chart (the `birth_charts_one_primary` unique index forbids two), then deletes the duplicates (cascade clears the rest). Pre-launch only; data loss acceptable (spec §6, §11).

**Files:**
- Create: `supabase/migrations/20260603000000_merge_duplicate_users.sql`

- [ ] **Step 1: (read-only) Preview duplicates before applying**

In the Supabase SQL editor (or `supabase db` shell), run:
```sql
select lower(email) as email_key, count(*) as users, array_agg(id order by created_at) as ids
from auth.users
where email is not null
group by lower(email)
having count(*) > 1;
```
Expected: zero rows (nothing to merge) or a small set of test dupes. Note the `ids` so Step 3's assertion has something to check.

- [ ] **Step 2: Create the migration file**

`supabase/migrations/20260603000000_merge_duplicate_users.sql`:
```sql
-- 2026-06-03: one-time cleanup — merge pre-launch duplicate auth.users that share an email.
-- Canonical = earliest created_at (tie-break lowest id). Re-points birth_charts / subscriptions /
-- profiles to the canonical user, preserving exactly one primary chart, then deletes the
-- duplicates (FK cascade clears anything still pointing at them). Idempotent: a no-op once each
-- email maps to a single user. Pre-launch / data-loss acceptable — see
-- docs/specs/2026-06-03-account-linking-design.md §6.
do $$
declare
  dup        record;
  canonical  uuid;
  dupe_ids   uuid[];
  keep_prim  uuid;
begin
  for dup in
    select lower(email) as email_key
    from auth.users
    where email is not null
    group by lower(email)
    having count(*) > 1
  loop
    -- canonical = earliest created, then lowest id
    select id into canonical
    from auth.users
    where lower(email) = dup.email_key
    order by created_at asc, id asc
    limit 1;

    select array_agg(id) into dupe_ids
    from auth.users
    where lower(email) = dup.email_key and id <> canonical;

    -- profiles: backfill canonical's display_name from a dupe if canonical's is null
    update public.profiles c
    set display_name = (
      select display_name from public.profiles
      where id = any(dupe_ids) and display_name is not null
      order by created_at asc
      limit 1
    )
    where c.id = canonical
      and c.display_name is null
      and exists (
        select 1 from public.profiles
        where id = any(dupe_ids) and display_name is not null
      );

    -- birth_charts: keep exactly one primary, then re-point. If canonical already has a primary,
    -- demote all dupes' primaries; else keep the earliest dupe primary and demote the rest.
    if exists (select 1 from public.birth_charts where user_id = canonical and is_primary) then
      keep_prim := null;
    else
      select id into keep_prim
      from public.birth_charts
      where user_id = any(dupe_ids) and is_primary
      order by created_at asc, id asc
      limit 1;
    end if;

    update public.birth_charts
    set is_primary = false
    where user_id = any(dupe_ids) and is_primary
      and (keep_prim is null or id <> keep_prim);

    update public.birth_charts
    set user_id = canonical
    where user_id = any(dupe_ids);

    -- subscriptions (PK user_id): move the best dupe sub only if canonical has none. Any other
    -- dupe subs are dropped by the cascade on delete below.
    if not exists (select 1 from public.subscriptions where user_id = canonical) then
      update public.subscriptions
      set user_id = canonical
      where user_id = (
        select user_id from public.subscriptions
        where user_id = any(dupe_ids)
        order by (status in ('active', 'trialing')) desc, current_period_end desc nulls last
        limit 1
      );
    end if;

    -- delete the duplicate users; cascade clears their profiles + any leftover subs
    delete from auth.users where id = any(dupe_ids);
  end loop;
end $$;
```

- [ ] **Step 3: Apply + verify**

Apply via the project's normal path (GitHub integration on push, or `supabase db push`). Then re-run the Step 1 preview query.
Expected: **zero rows** (every email now maps to exactly one user). Optionally confirm no user has two primaries:
```sql
select user_id, count(*) from public.birth_charts where is_primary group by user_id having count(*) > 1;
```
Expected: zero rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260603000000_merge_duplicate_users.sql
git commit -m "feat(db): one-time merge of pre-launch duplicate users by email"
```

---

## Task 8: Full suite + manual QA

The linking itself is Supabase server behavior and the Apple/native flow needs a device — verified by running, not unit tests.

- [ ] **Step 1: Run the mobile unit suite + typecheck**

Run: `pnpm --filter @astro/mobile test && pnpm --filter @astro/mobile typecheck`
Expected: all tests PASS (password incl. `passwordsMatch`, `interpretSignUp`, `appleAuth`, plus the pre-existing suite); typecheck clean.

- [ ] **Step 2: Build + run on an iOS dev build**

Apple Sign-In needs a dev/standalone build with the entitlement (Expo Go can't). With the Apple provider configured in Supabase (spec §9):
```bash
cd apps/mobile && pnpm ios
```

- [ ] **Step 3: Manual checklist**

- [ ] **Signup confirm field:** create-account mode shows **Confirm password**; mismatch shows "Passwords don't match." and disables Create account until they match and the policy passes.
- [ ] **Already exists:** sign up with an email that already exists → form flips to Sign in with the "account already exists" message; password/confirm cleared.
- [ ] **Sign-in hint:** a failed password sign-in shows "Invalid email or password." plus the muted "Used Google or Apple before?" hint.
- [ ] **Apple (iOS dev build):** the **Continue with Apple** button shows; tapping it runs the native sheet → signs in; the name appears in Account on first authorization.
- [ ] **Apple cancel:** dismissing the Apple sheet leaves the login sheet open with no error.
- [ ] **Linking — email/pw → Google/Apple:** sign up email/pw, confirm, sign out; sign in with Google/Apple on the **same email** → lands in the same account (same primary chart / data visible).
- [ ] **Android:** the Apple button is **absent**; Google + email/pw work as before.

- [ ] **Step 4: Final commit (if smoke test required tweaks)**

```bash
git add -A
git commit -m "test(mobile): account-linking + Apple sign-in manual smoke verified"
```

---

## Done → next

Same-email accounts resolve to one Supabase user across email/pw + Google + Apple on iOS; pre-launch duplicates are merged; messaging guides collisions. **Deferred follow-ups (spec §11):** Apple Sign-In on the web app, add-password flow for OAuth-only accounts, and conflict-preserving merges for real post-launch duplicates.
