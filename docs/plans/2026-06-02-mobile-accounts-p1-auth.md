# Mobile Accounts — Phase 1: Auth + Supabase Client — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email+password and Google sign-in/sign-out to the Expo mobile app against the **same Supabase project** the web uses, with a session that persists across launches and an Account screen.

**Architecture:** A configured `@supabase/supabase-js` client backed by AsyncStorage drives a React context (`AuthProvider`/`useAuth`). Two themed `Modal` screens (Login, Account) mirror the existing `BirthForm` pattern. Google uses the browser-OAuth flow (`expo-web-browser` + `expo-linking` deep link → `exchangeCodeForSession`). This phase adds identity only — birth-chart sync (Phase 2), the Pro/Free badge (Phase 3), gating (Phase 4), and the edit throttle (Phase 5) are separate plans.

**Tech Stack:** Expo SDK 54 / React Native 0.81 / React 19, `@supabase/supabase-js` v2, `@react-native-async-storage/async-storage`, `expo-web-browser`, `expo-linking`, `react-native-url-polyfill`.

**Spec:** `docs/specs/2026-06-02-mobile-accounts-entitlement-gating-design.md` (§4.1, §4.2).

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/mobile/package.json` | add auth/Supabase deps |
| `apps/mobile/app.json` | add the `scheme` for OAuth deep-linking |
| `apps/mobile/.env.example` | document the two public env vars (real `.env` is user-provided, gitignored) |
| `apps/mobile/.gitignore` | ignore `.env` |
| `apps/mobile/lib/password.ts` (+ `.test.ts`) | pure password policy, lockstep with web (TDD) |
| `apps/mobile/lib/supabase.ts` | the configured RN Supabase client + AppState refresh |
| `apps/mobile/lib/auth.tsx` | `AuthProvider` / `useAuth` — session + sign in/up/out/google |
| `apps/mobile/components/auth/LoginScreen.tsx` | email/pw + Google login modal |
| `apps/mobile/components/auth/AccountView.tsx` | email + name + Sign out modal |
| `apps/mobile/App.tsx` | wrap in `AuthProvider`; header affordance; render the two modals |

**Out of this phase:** the Pro/Free badge in AccountView, birth-chart sync, gating, throttle. AccountView shows email + name + Sign out only; the badge lands in Phase 3.

---

## Task 1: Dependencies, app scheme, and env

**Files:**
- Modify: `apps/mobile/package.json` (via `expo install`)
- Modify: `apps/mobile/app.json`
- Create: `apps/mobile/.env.example`
- Modify: `apps/mobile/.gitignore`

- [ ] **Step 1: Install the packages (Expo picks SDK-54-compatible versions)**

Run:
```bash
cd apps/mobile && npx expo install @supabase/supabase-js react-native-url-polyfill expo-web-browser expo-linking react-native-get-random-values
```
Expected: `package.json` gains those `dependencies`; `pnpm-lock.yaml` updates. (`@react-native-async-storage/async-storage` is already present.)

- [ ] **Step 2: Add the deep-link `scheme` to `app.json`**

In `apps/mobile/app.json`, inside the top-level `"expo"` object, add a `"scheme"` key (sibling of `"name"`/`"slug"`):
```json
"scheme": "movestar",
```
This makes `Linking.createURL("auth-callback")` resolve to `movestar://auth-callback` in a dev/standalone build (and an `exp://…/--/auth-callback` proxy URL in Expo Go).

- [ ] **Step 3: Create `apps/mobile/.env.example`**

```bash
# Supabase — same project as apps/web. Anon (publishable) key only; never the service role key.
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 4: Ensure the real `.env` is ignored**

Append to `apps/mobile/.gitignore` (create the file if absent) on its own line:
```
.env
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/.env.example apps/mobile/.gitignore pnpm-lock.yaml
git commit -m "chore(mobile): add Supabase + OAuth deps, app scheme, env scaffold"
```

---

## Task 2: Password policy (TDD)

Pure, runs under the mobile `node --test` runner (`lib/*.test.ts`). Mirrors `apps/web/lib/password.ts` exactly so both platforms enforce one rule.

**Files:**
- Create: `apps/mobile/lib/password.ts`
- Test: `apps/mobile/lib/password.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/mobile/lib/password.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePassword } from "./password.ts";

test("validatePassword: valid password passes with no problems", () => {
  const r = validatePassword("abcd1234");
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
});

test("validatePassword: too short is flagged", () => {
  const r = validatePassword("ab12");
  assert.equal(r.ok, false);
  assert.ok(r.problems.includes("at least 8 characters"));
});

test("validatePassword: missing letter and number are each flagged", () => {
  assert.deepEqual(validatePassword("12345678").problems, ["a letter"]);
  assert.deepEqual(validatePassword("abcdefgh").problems, ["a number"]);
});

test("validatePassword: empty string reports all three problems", () => {
  assert.deepEqual(validatePassword("").problems, ["at least 8 characters", "a letter", "a number"]);
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `pnpm --filter @astro/mobile test`
Expected: FAIL — `Cannot find module './password.ts'` (or the file does not exist).

- [ ] **Step 3: Implement `apps/mobile/lib/password.ts`**

```ts
export interface PasswordCheck {
  ok: boolean;
  problems: string[];
}

/** Policy: >= 8 chars, >= 1 letter, >= 1 number. Lockstep with apps/web/lib/password.ts
 *  and mirrored in the Supabase dashboard policy (the server is the real gate). */
export function validatePassword(pw: string): PasswordCheck {
  const problems: string[] = [];
  if (pw.length < 8) problems.push("at least 8 characters");
  if (!/[A-Za-z]/.test(pw)) problems.push("a letter");
  if (!/[0-9]/.test(pw)) problems.push("a number");
  return { ok: problems.length === 0, problems };
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS (the 4 new tests, plus the existing mobile suite stays green).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/password.ts apps/mobile/lib/password.test.ts
git commit -m "feat(mobile): password policy (lockstep with web)"
```

---

## Task 3: Supabase client

**Files:**
- Create: `apps/mobile/lib/supabase.ts`

- [ ] **Step 1: Implement `apps/mobile/lib/supabase.ts`**

```ts
// These two polyfills MUST come first, before supabase-js loads:
//  - get-random-values: PKCE generates its code verifier with crypto.getRandomValues, which
//    Hermes does not provide natively.
//  - url-polyfill: supabase-js relies on the WHATWG URL API in React Native.
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail fast and loud — a missing env var otherwise surfaces as opaque network errors.
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.example to apps/mobile/.env and fill in the values.",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // there is no browser URL to read the session from on native
    flowType: "pkce",
  },
});

// Auto-refresh tokens only while the app is foregrounded — the documented Supabase RN pattern.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS (no type errors). If `process.env.EXPO_PUBLIC_*` types are missing, they are `string | undefined` by default — the `if (!url …)` guard narrows them; no change needed.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/supabase.ts
git commit -m "feat(mobile): configured Supabase client (AsyncStorage session, PKCE, AppState refresh)"
```

---

## Task 4: Auth provider

`AuthProvider` exposes session + actions. Google sign-in uses the browser OAuth flow and parses the returned deep link with `expo-linking`.

**Files:**
- Create: `apps/mobile/lib/auth.tsx`

- [ ] **Step 1: Implement `apps/mobile/lib/auth.tsx`**

```tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Result shape for the auth actions: `error` set on failure; `needsConfirm` set when
 *  signUp created an unconfirmed account (email confirmation is ON on the project). */
export interface AuthResult {
  error?: string;
  needsConfirm?: boolean;
}

interface AuthValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  async function signUp(email: string, password: string, name: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name } },
    });
    if (error) return { error: error.message };
    // With email confirmation ON, signUp returns no session until the link is clicked.
    return { needsConfirm: !data.session };
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: "Invalid email or password." } : {};
  }

  async function signInWithGoogle(): Promise<AuthResult> {
    const redirectTo = Linking.createURL("auth-callback");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) return { error: error?.message ?? "Could not start Google sign-in." };

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== "success") return {}; // user dismissed the browser — not an error

    const { queryParams } = Linking.parse(res.url);
    const code = typeof queryParams?.code === "string" ? queryParams.code : undefined;
    if (!code) return { error: "Google sign-in did not return an auth code." };

    const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
    return exErr ? { error: exErr.message } : {};
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signUp, signIn, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within an AuthProvider");
  return v;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS. (If `expo-web-browser`/`expo-linking` types are missing, re-run `npx expo install expo-web-browser expo-linking` from Task 1.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/lib/auth.tsx
git commit -m "feat(mobile): AuthProvider/useAuth (email+pw, Google OAuth, sign out)"
```

---

## Task 5: Login screen

A themed `Modal` mirroring the `BirthForm` pattern: a Sign in ⇄ Create account toggle, Google button, name (signup), email, password with live policy hint, and error/info messages. Logic mirrors `apps/web/app/login/LoginForm.tsx`.

**Files:**
- Create: `apps/mobile/components/auth/LoginScreen.tsx`

- [ ] **Step 1: Implement `apps/mobile/components/auth/LoginScreen.tsx`**

```tsx
import { useMemo, useState } from "react";
import {
  Modal, View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { validatePassword } from "../../lib/password";

type Mode = "signin" | "signup";

export function LoginScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pw = validatePassword(password);
  const isIos = Platform.OS === "ios";

  function reset() {
    setName(""); setEmail(""); setPassword("");
    setError(null); setInfo(null); setBusy(false);
  }
  function close() { reset(); onClose(); }

  async function onSubmit() {
    setError(null); setInfo(null);
    if (mode === "signup") {
      if (!pw.ok) { setError(`Password needs ${pw.problems.join(", ")}.`); return; }
      setBusy(true);
      const r = await signUp(email.trim(), password, name.trim());
      setBusy(false);
      if (r.error) { setError(r.error); return; }
      if (r.needsConfirm) {
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
        setPassword("");
        return;
      }
      close(); // confirmation off → session active → done
      return;
    }
    setBusy(true);
    const r = await signIn(email.trim(), password);
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    close();
  }

  async function onGoogle() {
    setError(null); setInfo(null); setBusy(true);
    const r = await signInWithGoogle();
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    // Success closes via the onAuthStateChange listener flipping session; close the sheet too.
    close();
  }

  const submitDisabled = busy || !email.trim() || !password || (mode === "signup" && !pw.ok);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.root} behavior={isIos ? "padding" : undefined}>
        <View style={styles.backdrop} />
        <View style={styles.sheet}>
          <Text style={styles.brand}>MoveStar</Text>
          <Text style={styles.title}>{mode === "signin" ? "Sign in" : "Create account"}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <Pressable style={styles.google} onPress={onGoogle} disabled={busy}>
              <Text style={styles.googleText}>Continue with Google</Text>
            </Pressable>
            <View style={styles.dividerRow}>
              <View style={styles.divider} /><Text style={styles.or}>or</Text><View style={styles.divider} />
            </View>

            {mode === "signup" && (
              <>
                <Text style={styles.label}>Name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName}
                  placeholder="You" placeholderTextColor={p.textDim} autoCapitalize="words" />
              </>
            )}
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail}
              placeholder="you@example.com" placeholderTextColor={p.textDim}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor={p.textDim} secureTextEntry />

            {mode === "signup" && password.length > 0 && !pw.ok && (
              <Text style={styles.hint}>Needs {pw.problems.join(", ")}.</Text>
            )}
            {error ? <Text style={styles.err}>{error}</Text> : null}
            {info ? <Text style={styles.ok}>{info}</Text> : null}
          </ScrollView>

          <Pressable style={[styles.submit, submitDisabled && styles.submitOff]} onPress={onSubmit} disabled={submitDisabled}>
            <Text style={styles.submitText}>{busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}</Text>
          </Pressable>
          <Pressable style={styles.toggle} onPress={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}>
            <Text style={styles.toggleText}>
              {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
            </Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={close}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: p.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28, maxHeight: "92%",
  },
  brand: { color: p.text, fontSize: 18, letterSpacing: 3, fontWeight: "600", textAlign: "center" },
  title: { color: p.text, fontSize: 22, fontWeight: "700", textAlign: "center", marginTop: 4, marginBottom: 10 },
  scroll: { marginBottom: 12 },
  google: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  googleText: { color: p.text, fontSize: 16, fontWeight: "600" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 14 },
  divider: { flex: 1, height: 1, backgroundColor: p.border },
  or: { color: p.textDim, fontSize: 13 },
  label: { color: p.seclabel, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, color: p.text, fontSize: 16 },
  hint: { color: p.textDim, fontSize: 13, marginTop: 8 },
  err: { color: "#ff6b6b", fontSize: 14, marginTop: 12 },
  ok: { color: p.live, fontSize: 14, marginTop: 12 },
  submit: { backgroundColor: p.live, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  submitOff: { opacity: 0.5 },
  submitText: { color: p.bg, fontSize: 16, fontWeight: "700" },
  toggle: { paddingVertical: 12, alignItems: "center" },
  toggleText: { color: p.live, fontSize: 14 },
  cancel: { paddingVertical: 6, alignItems: "center" },
  cancelText: { color: p.textDim, fontSize: 14 },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/auth/LoginScreen.tsx
git commit -m "feat(mobile): LoginScreen (email/pw + Google, live password policy)"
```

---

## Task 6: Account view

A themed `Modal` showing the signed-in email, display name (from `user_metadata.name`), and a **Sign out** button. (The Pro/Free badge is added in Phase 3.)

**Files:**
- Create: `apps/mobile/components/auth/AccountView.tsx`

- [ ] **Step 1: Implement `apps/mobile/components/auth/AccountView.tsx`**

```tsx
import { useMemo, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import type { Palette } from "@astro/engine";
import { useTheme } from "../../lib/theme";
import { useAuth } from "../../lib/auth";

export function AccountView({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { palette: p } = useTheme();
  const styles = useMemo(() => makeStyles(p), [p]);
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const name = (user?.user_metadata?.name as string | undefined) ?? null;
  const email = user?.email ?? "—";

  async function onSignOut() {
    setBusy(true);
    await signOut();
    setBusy(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.backdrop} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Account</Text>
          {name ? (
            <>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{name}</Text>
            </>
          ) : null}
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{email}</Text>

          <Pressable style={[styles.signout, busy && styles.signoutOff]} onPress={onSignOut} disabled={busy}>
            <Text style={styles.signoutText}>{busy ? "…" : "Sign out"}</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (p: Palette) => StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    backgroundColor: p.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28,
  },
  title: { color: p.text, fontSize: 22, fontWeight: "700", marginBottom: 8 },
  label: { color: p.seclabel, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginTop: 14, marginBottom: 2 },
  value: { color: p.text, fontSize: 16 },
  signout: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 22 },
  signoutOff: { opacity: 0.5 },
  signoutText: { color: "#ff6b6b", fontSize: 16, fontWeight: "700" },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: p.textDim, fontSize: 14 },
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/auth/AccountView.tsx
git commit -m "feat(mobile): AccountView (email, name, sign out)"
```

---

## Task 7: Wire into `App.tsx`

Wrap the app in `AuthProvider`, add a header affordance ("Sign in" when logged out, "Account" when logged in), and render the two modals. The existing avatar still opens the birth form.

**Files:**
- Modify: `apps/mobile/App.tsx`

- [ ] **Step 1: Add imports**

In `apps/mobile/App.tsx`, add these import lines next to the other component imports (after the `Avatar` import on line 17):
```tsx
import { AuthProvider, useAuth } from "./lib/auth";
import { LoginScreen } from "./components/auth/LoginScreen";
import { AccountView } from "./components/auth/AccountView";
```

- [ ] **Step 2: Rename the default export to an inner component and wrap it**

Change the function signature on line 29 from:
```tsx
export default function App() {
```
to:
```tsx
function AppInner() {
```
Then at the very end of the file (after `AppInner`'s closing `}` and before `const makeStyles`), add the wrapper export:
```tsx
export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Read auth state + add modal visibility state inside `AppInner`**

Immediately after the existing `const [editing, setEditing] = useState(false);` line, add:
```tsx
  const { session } = useAuth();
  const [authView, setAuthView] = useState<null | "login" | "account">(null);
```

- [ ] **Step 4: Add the header affordance**

In the `headerRow` `View` (currently brand + the edit `Pressable`), add a sign-in/account control before the existing edit `Pressable`. Replace the `headerRow` block:
```tsx
        <View style={styles.headerRow}>
          <Text style={styles.brand}>MoveStar</Text>
          <Pressable onPress={() => setEditing(true)} style={styles.editBtn} hitSlop={8}>
            <Avatar glyph={sunGlyph} />
          </Pressable>
        </View>
```
with:
```tsx
        <View style={styles.headerRow}>
          <Text style={styles.brand}>MoveStar</Text>
          <View style={styles.headerRight}>
            <Pressable onPress={() => setAuthView(session ? "account" : "login")} style={styles.authBtn} hitSlop={8}>
              <Text style={styles.authText}>{session ? "Account" : "Sign in"}</Text>
            </Pressable>
            <Pressable onPress={() => setEditing(true)} style={styles.editBtn} hitSlop={8}>
              <Avatar glyph={sunGlyph} />
            </Pressable>
          </View>
        </View>
```

- [ ] **Step 5: Render the two modals**

Right after the existing `<BirthForm … />` line (near the end of `AppInner`'s JSX, before `<StatusBar … />`), add:
```tsx
      <LoginScreen visible={authView === "login"} onClose={() => setAuthView(null)} />
      <AccountView visible={authView === "account"} onClose={() => setAuthView(null)} />
```

- [ ] **Step 6: Add the two new styles**

In the `makeStyles` `StyleSheet.create({…})` object, add after the `editBtn` style:
```tsx
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  authBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderColor: p.border, borderWidth: 1 },
  authText: { color: p.live, fontSize: 13, letterSpacing: 0.5, fontWeight: "600" },
```

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): wire AuthProvider + Sign in/Account into the header"
```

---

## Task 8: Verify the full suite + manual smoke test

These flows touch the live Supabase project and the RN runtime, so they are verified by running the app, not by unit tests.

- [ ] **Step 1: Run the mobile unit suite + typecheck**

Run: `pnpm --filter @astro/mobile test && pnpm --filter @astro/mobile typecheck`
Expected: all tests PASS (password tests + the pre-existing suite), typecheck clean.

- [ ] **Step 2: Start the app with the env set**

Create `apps/mobile/.env` from `.env.example` with the real project URL + anon key (same project as web), then:
```bash
cd apps/mobile && pnpm start
```
Open in Expo Go (email/password works here) or a dev build (required for Google deep-linking — see spec §10).

- [ ] **Step 3: Manual checklist**

Verify and check each:
- [ ] App launches with no "Missing EXPO_PUBLIC_…" error; header shows **Sign in** (logged out).
- [ ] **Sign up** with a new email + a policy-valid password → see "Check your email to confirm".
- [ ] The password hint appears for a weak password and the Create-account button is disabled until valid.
- [ ] Confirm via the emailed link, return to the app, **Sign in** → the header switches to **Account**.
- [ ] **Account** shows the email (and name if provided) + **Sign out**; signing out returns the header to **Sign in**.
- [ ] Session **persists**: fully close and reopen the app → still signed in.
- [ ] (Dev build) **Continue with Google** opens the browser, returns, and signs in; cancelling the browser is a silent no-op.
- [ ] The existing chart + birth-form avatar still work unchanged.

- [ ] **Step 4: Final commit (if any tweaks were needed during smoke test)**

```bash
git add -A
git commit -m "test(mobile): Phase 1 auth manual smoke verified"
```

---

## Phase 1 done → next

Sign-in/out + accounts work against the shared Supabase project; nothing syncs yet. **Phase 2** (birth-chart sync + `iana_tz` migration) is the next plan — it makes the signed-in user's birth chart load from and save to `birth_charts`, with the first-login local→DB migration.
