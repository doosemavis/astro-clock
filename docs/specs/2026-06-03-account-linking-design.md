# Mobile Account Linking (same email → one user) + Apple Sign-In — Design

**Date:** 2026-06-03
**Author:** moosedavis + Claude
**Status:** Approved (brainstorm); pending implementation plan
**Implements:** memory `account-linking-same-email` and the platform rule in memory
`auth-provider-platform-matrix`. Picks up the "Sign in with Apple" item left out of scope by
`docs/specs/2026-06-02-mobile-accounts-entitlement-gating-design.md` §12.

---

## 1. Goal & scope

A user who authenticates with **email/password**, **Google**, or **Apple** on the **same email
address** must resolve to a **single Supabase `auth.users` row** — so their `profiles`,
`birth_charts`, and `subscriptions` never fork across sign-in methods. This protects the
cross-platform account + entitlement sync.

The strategy is **prevention, not runtime merging**: lean on Supabase's built-in automatic
identity linking (which attaches a new identity to an existing user when the email matches and is
verified), make sure its preconditions always hold, add **native Apple Sign-In on iOS**, show
**graceful "already exists" messaging** instead of silent duplicates, and run a **one-time
cleanup migration** to merge any pre-launch test duplicates.

**Not in this slice:** an "add a password to an OAuth-only account" flow (handled by messaging),
a runtime in-app account-merge tool, and **Apple Sign-In on the web app** (a deferred follow-up;
the platform end-state is documented in §2 and memory `auth-provider-platform-matrix`).

---

## 2. Decisions (locked)

- **Linking mechanism = Supabase automatic identity linking.** We do not write linking logic.
  Per Supabase docs, a new OAuth sign-in is linked to an existing user when the email matches and
  is **verified**; it will *not* link to a user with an **unverified** email (prevents
  pre-account-takeover). Google and Apple return verified emails; the email/pw path is verified
  via email confirmation, which **stays ON**.
- **Enforcement model = prevent + one-time cleanup.** No runtime merge tool, no admin Edge
  Function. New duplicates are prevented by the mechanism above; pre-existing test duplicates are
  swept by a single idempotent SQL migration (§6).
- **Providers & platform gating** (memory `auth-provider-platform-matrix`):

  | Surface | Apple | Google | Email/pw |
  |---|---|---|---|
  | iOS app (mobile/tablet) | **yes (this slice)** | yes | yes |
  | Android app | **no** | yes | yes |
  | Web app | yes (later slice) | yes | yes |

- **Apple Sign-In = native, iOS-only.** `expo-apple-authentication` →
  `supabase.auth.signInWithIdToken({ provider: 'apple', token, nonce })`. Requires a dev/standalone
  build (Expo Go cannot do native Apple auth).
- **"Add password to an OAuth account" = messaging only.** When an OAuth-only user tries to create
  a password account on the same email, we detect it and guide them to sign in, rather than build
  an add-password flow.
- **Signup form gets a confirm-password field** with a client-side match check, on top of the
  existing `validatePassword` policy.
- **Cleanup is pre-launch / data-loss-acceptable** — a single idempotent migration; canonical =
  earliest `created_at`, tie-break lowest `id`.

---

## 3. Architecture

### 3.1 Linking (prevention) — no new code, configuration + invariants

Supabase auto-links by verified email. The job here is to keep its preconditions true and verify
the behavior:

- **Email confirmation stays ON** — it is what makes the email/pw identity "verified" and therefore
  linkable, and it is also what powers the §3.3 "already exists" detection.
- **Verify the Apple provider** is enabled and the iOS bundle id is an authorized client id (§9),
  so Apple id-token sign-in succeeds and links.
- **Documented nuance:** auto-link requires the *existing* account to be verified. "Sign up email/pw
  but never confirm, then use Google/Apple" can briefly fork; Supabase prunes unconfirmed
  identities and the §6 cleanup sweeps stragglers. The happy path (confirm, then link) is solid.
- **Apple "Hide My Email":** a private-relay address won't match a user's real email, so it cannot
  link by email. Inherent to email-based linking; documented, not solved here.

### 3.2 Apple Sign-In (iOS) — `apps/mobile/lib/auth.tsx` + `appleAuth.ts`

- Add **`signInWithApple(): Promise<AuthResult>`** to the `AuthValue` interface, mirroring
  `signInWithGoogle` and returning the same envelope (`{ error? }`, `{ cancelled? }`).
- **Flow** (extracted into a small `apps/mobile/lib/appleAuth.ts` for testability):
  1. Generate a random nonce; SHA-256 hash it (`expo-crypto`).
  2. `AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME, EMAIL], nonce: hashedNonce })`.
  3. `supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken,
     nonce: rawNonce })` — Supabase validates the token + nonce and auto-links by verified email.
- **Name capture quirk:** Apple returns `fullName` **only on the first authorization**. On success,
  if `fullName` is present and `profiles.display_name` is empty, write it (best-effort; §7).
- **Cancel:** `ERR_REQUEST_CANCELED` → `{ cancelled: true }` (sheet stays open), like Google.

### 3.3 Graceful messaging — `apps/mobile/lib/authResult.ts` + `auth.tsx` + `LoginScreen.tsx`

- **Detection:** `supabase.auth.signUp()` on an already-registered email returns an obfuscated
  *fake success* — a `user` with an **empty `identities` array** and no session. Extract a pure
  **`interpretSignUp(data): 'success' | 'needs_confirm' | 'already_exists'`**:
  - empty `identities` + no session → `already_exists`
  - non-empty `identities` + no session → `needs_confirm`
  - session present → `success`
- **`AuthResult`** gains `alreadyExists?: boolean`; `signUp` maps from `interpretSignUp`.
- **`LoginScreen` UX:**
  - `alreadyExists` → switch to sign-in mode + message: *"An account with this email already
    exists. Sign in below — if you first used Google or Apple, use those buttons above."*
  - Password sign-in failure → keep *"Invalid email or password."* plus a muted hint: *"Used Google
    or Apple before? Use the buttons above."* (client can't safely distinguish wrong-password from
    OAuth-only without leaking, so guide generically).

### 3.4 Signup form — confirm password — `LoginScreen.tsx`

- New `confirmPassword` state, rendered **only in signup mode** below the password field.
- Live mismatch hint *"Passwords don't match."* once both fields have input and differ.
- `submitDisabled` (signup) now also requires `password === confirmPassword`, on top of the
  existing `validatePassword` policy. Purely client-side; no `auth.tsx` change.

### 3.5 Apple button gating — `LoginScreen.tsx`

- Render the Apple button only when `Platform.OS === 'ios'` **and**
  `AppleAuthentication.isAvailableAsync()` resolves true. Android/web never render it.

---

## 4. Components / boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `apps/mobile/lib/appleAuth.ts` | nonce + Apple credential → `signInWithIdToken` args (pure-ish, testable) | expo-apple-authentication, expo-crypto |
| `apps/mobile/lib/authResult.ts` | pure `interpretSignUp(data)` classifier | — |
| `apps/mobile/lib/auth.tsx` | add `signInWithApple`; map `signUp` via `interpretSignUp`; best-effort Apple name write | supabase client, appleAuth, authResult |
| `apps/mobile/components/auth/LoginScreen.tsx` | Apple button (iOS-gated), confirm-password field, "already exists" + sign-in-fail messaging | auth, password, AppleAuthentication |
| `supabase/migrations/<ts>_merge_duplicate_users.sql` | one-time idempotent dupe merge | — |

No changes to `supabase.ts`, `AccountView.tsx`, or the web app in this slice.

---

## 5. Data flow

- **email/pw → later Google/Apple (same email):** confirm email (verified) → OAuth sign-in →
  Supabase auto-links the new identity to the existing user → same `auth.users.id`, no fork.
- **Google/Apple first → tries password signup (same email):** `signUp` returns empty `identities`
  → `interpretSignUp` → `already_exists` → `LoginScreen` guides to sign in via the OAuth button.
- **Apple first-time sign-in:** id-token exchange creates/links the user; `fullName` (first time
  only) written to `profiles.display_name` if empty.
- **Cleanup (one-time):** migration finds same-email duplicate `auth.users`, picks canonical,
  re-points app data, deletes dupes; lost OAuth identities self-heal on next sign-in via auto-link.

## 6. Database migration — one-time dupe cleanup

A single idempotent file under `supabase/migrations/` (applied via the GitHub integration /
`supabase db push`, never a hand-edit to a live DB). Per duplicate-email group:

1. **Canonical** = the `auth.users` row with the earliest `created_at` (tie-break: lowest `id`).
2. **Re-point app data to canonical:**
   - `birth_charts.user_id` → canonical.
   - `profiles`: keep canonical's row; backfill `display_name` from a dupe if canonical's is null.
   - `subscriptions` (PK `user_id`): keep canonical's row if present, else move a dupe's; on
     conflict keep the active `status` / latest `current_period_end`.
3. `DELETE FROM auth.users WHERE id = <dupe>` — cascade clears the dupe's now-orphaned rows.

**Why deleting a dupe's OAuth identity is safe here:** on the user's next sign-in with that
provider, Supabase auto-links it to the canonical user (verified email match, §3.1). Linking
self-heals; no manual `auth.identities` surgery.

**Safety:** idempotent and re-runnable (no-op when no dupes); runs with migration admin rights so
it may touch `auth.users`. Plan includes a read-only `select` to eyeball dupes before applying.
Exact SQL is drafted in the implementation plan.

## 7. Error handling

- **Apple:** `ERR_REQUEST_CANCELED` → silent no-op (sheet open); token-exchange/other failures →
  inline friendly message via `AuthResult.error`.
- **Apple name write is best-effort:** wrapped in its own `try/catch`; must never fail the
  sign-in, but logs on failure (not silently swallowed).
- **Signup:** `already_exists` → actionable sign-in guidance; weak password caught client-side
  first; `needs_confirm` → "check your email" state (existing behavior).
- **Sign-in:** generic "Invalid email or password" + muted OAuth hint; never reveals which field
  or which provider.
- **Migration:** raises nothing on empty input; safe to re-run.
- All async boundaries use try/catch with user-friendly copy; no swallowed errors.

## 8. Testing

- **Unit (Jest, mobile):**
  - `interpretSignUp`: empty `identities` → already_exists; non-empty + no session → needs_confirm;
    session → success.
  - confirm-password matching + policy gating (with `validatePassword`).
  - `appleAuth`: mocked `AppleAuthentication` credential + nonce → correct `signInWithIdToken` args.
- **Manual QA (auto-link is server behavior — not unit-testable):**
  1. email/pw → confirm → Google same email → **same user id**.
  2. Google first → email/pw signup same email → **"already exists"** message.
  3. Apple on iOS → links/creates; name captured first time only.
  4. Apple cancel → sheet stays open.
  5. **Android → no Apple button**; web unaffected.
  6. Migration: seed a dupe, run, assert one canonical user with data re-pointed.

## 9. External setup (user — I cannot do these)

1. **Apple Developer:** App ID with the *Sign In with Apple* capability; a Services ID; a Sign-In
   key/secret.
2. **Supabase:** enable the **Apple** auth provider; register the iOS **bundle identifier** as an
   authorized client id. Confirm **email confirmation stays ON** and automatic identity linking is
   active.
3. **Expo:** add the `expo-apple-authentication` config plugin + `ios.usesAppleSignIn: true`;
   produce a **dev/standalone build** (Expo Go can't do native Apple auth).
4. **Apply** the cleanup migration (§6) via the GitHub integration / `supabase db push` after a
   quick read-only dupe check.

## 10. Security notes

- Linking relies on Supabase's verified-email precondition — the documented guard against
  pre-account-takeover. Email confirmation ON is therefore a security invariant, not just UX.
- The Apple nonce (hashed in the request, raw to `signInWithIdToken`) binds the credential to this
  client and prevents replay.
- The cleanup migration touches `auth.users` only at migration time with admin rights; no
  service-role key ships in the app (anon key only, per the accounts design).

## 11. Out of scope (later slices)

Apple Sign-In on the **web app**; an add-password flow for OAuth-only accounts; a runtime in-app
account-merge tool; password reset / magic link; native Google Sign-In SDK; merging **real**
(post-launch) duplicate accounts with conflict-preserving rules.

## 12. Related

- Memory `account-linking-same-email`, `auth-provider-platform-matrix`, `cross-platform-account-sync`.
- `docs/specs/2026-06-02-mobile-accounts-entitlement-gating-design.md` — the accounts/entitlement
  slice this builds on (its §12 deferred Apple Sign-In to here).
