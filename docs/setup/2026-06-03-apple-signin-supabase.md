# Apple Sign-In (native iOS) + Supabase — Setup Runbook

Companion to `docs/specs/2026-06-03-account-linking-design.md` §9 and the plan
`docs/plans/2026-06-03-account-linking.md` (Task 8). This is the **user-only external setup** that
the code cannot do. Follow top to bottom; check each box.

**Scope:** the **native iOS** flow only (`supabase.auth.signInWithIdToken({ provider: 'apple', … })`).
The native flow is validated by your app's **Bundle ID**, so you do **NOT** need an Apple *Services
ID* or *secret key* here — those are only for the **web** OAuth flow, which is a later slice.

**Bundle ID for this app:** `com.movestar.app` (from `apps/mobile/app.json`).

---

## 0. Prerequisite

- [ ] You have an active **Apple Developer Program** membership ($99/yr). "Sign in with Apple"
  requires it — a free Apple ID is not enough.

---

## 1. Apple Developer — enable the "Sign In with Apple" capability

You need the App ID for `com.movestar.app` to have the *Sign In with Apple* capability. Two paths —
pick the one matching how you build:

### Path A — EAS Build (managed credentials)
- [ ] When you run `eas build` (dev client), EAS auto-creates/updates the App ID, adds the *Sign In
  with Apple* capability, and regenerates the provisioning profile. Just be signed into your Apple
  account when prompted. Nothing to do in the portal by hand.

### Path B — local `expo run:ios` / Xcode-managed signing (matches the repo's dev-build scripts)
- [ ] `usesAppleSignIn: true` in `app.json` (already set) makes `expo prebuild` add the
  `com.apple.developer.applesignin` entitlement to the generated `ios/` project.
- [ ] Open the generated workspace in Xcode → target **MoveStar** → *Signing & Capabilities* → select
  your **Team** with *Automatically manage signing* on. Xcode registers the App ID `com.movestar.app`
  and attaches the *Sign In with Apple* capability.
- [ ] If automatic signing doesn't add it, do it manually in the portal:
  1. <https://developer.apple.com/account/resources/identifiers/list> → Identifiers.
  2. Open (or create) the App ID with Bundle ID `com.movestar.app`.
  3. Tick **Sign In with Apple** → **Save**.

---

## 2. Supabase — enable the Apple provider (native)

In the **same Supabase project** the web app uses:

- [ ] Dashboard → **Authentication → Providers → Apple** → toggle **Enabled**.
- [ ] In **Authorized Client IDs** (a comma-separated list), add the iOS Bundle ID:
  ```
  com.movestar.app
  ```
- [ ] Leave **Secret Key (for OAuth)** / Services ID **empty** — not needed for the native
  `signInWithIdToken` flow.
- [ ] **Save.**

---

## 3. Supabase — confirm the linking invariants (spec §3.1 / §3.3)

- [ ] Authentication → Providers → **Email**: **Confirm email** stays **ON**. This is what makes the
  email/password identity "verified" (so it links) and powers the "already exists" detection.
- [ ] Automatic identity linking by email is active (Supabase default — it links a new verified
  identity to an existing user with the same verified email). No toggle needed unless it was changed.

---

## 4. Build a native dev client + test

Apple Sign-In is **not available in Expo Go** — it needs a native build with the entitlement.

- [ ] Build & run a dev client:
  ```bash
  cd apps/mobile && pnpm ios      # = npx expo run:ios
  ```
  (or an EAS dev build, Path A).
- [ ] **Simulator only:** sign into an Apple ID first — iOS Settings → *Sign in to your iPhone* —
  otherwise the Apple sheet errors.
- [ ] Open the login sheet → a **Continue with Apple** button appears (iOS only) → tap → complete the
  native sheet.
- [ ] First-ever sign-in: your name is captured and shows in **Account**. (Apple only sends the name
  once, ever — if you've authorized this app before, revoke it under iOS Settings → your name →
  *Sign in with Apple* → the app → *Stop using* to test the first-run name path again.)
- [ ] Linking check: sign up with email/password (confirm the email), sign out, then **Continue with
  Apple** using the **same email** → you land in the same account (same chart/data).

---

## 5. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Unacceptable audience in id_token` (or "invalid audience") on `signInWithIdToken` | Bundle ID not in Supabase **Authorized Client IDs** (Step 2). Add `com.movestar.app`. |
| No **Continue with Apple** button | Running Expo Go, or `isAvailableAsync()` is false → build a native dev client (Step 4) after `prebuild` so the entitlement is present. |
| Native Apple sheet says Sign in with Apple isn't enabled | App ID capability missing (Step 1) — enable it and rebuild. |
| Apple sheet errors immediately on the simulator | No Apple ID signed into the simulator (Step 4). |
| Name never appears | Apple only returns it on the **first** authorization — revoke and retry (Step 4). |

---

## Deferred to a later slice (web app)

When you add Apple Sign-In to the **web** app (apps/web), that flow *does* need an Apple **Services
ID** + a **Sign In with Apple key** (the `.p8`) to generate the OAuth secret, plus the secret pasted
into the Supabase Apple provider. Out of scope here (spec §11).
