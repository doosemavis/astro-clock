# Mobile Accounts + Cross-Platform Entitlement & Pro Gating — Design

**Date:** 2026-06-02
**Author:** moosedavis + Claude
**Status:** Approved (brainstorm); pending implementation plan
**Implements:** the account half of memory `cross-platform-account-sync`; the read-only
foundation (P1) of the billing research in
`docs/research/2026-06-02-cross-platform-billing-scope.md`.

---

## 1. Goal & scope

Give the mobile (Expo/React Native) app sign-in/sign-up/sign-out against the **same Supabase
project** the web app already uses, sync each user's primary birth chart to the shared
`birth_charts` table, read their subscription state to show **Pro/Free**, and gate features by
that state on **both** web and mobile. Add an anti-abuse **throttle** on birth-detail edits.

The app stays **freemium / anonymous-first**: everything that works today works logged-out.
Signing in adds cross-device sync and the entitlement; Pro unlocks the gated features.

**This slice does NOT add a mobile purchase flow.** Mobile users become Pro via a web (Stripe)
purchase, which unlocks mobile through the shared entitlement. The in-app buy button is the
billing slice (see §13).

---

## 2. Decisions (locked)

- **Same Supabase project** as web. Mobile uses the **anon key only**; Row-Level Security is the
  real data guard (mirrors the web design).
- **Auth methods:** email+password **and** Google — matching the web. Email-confirm ON. Google on
  mobile uses the **browser OAuth** flow (`expo-web-browser` + deep-link redirect), reusing the
  **existing** Supabase Google provider — no new Google client this slice. (Native Google SDK is
  deferred; see §12.)
- **Implementation approach A** (chosen): browser OAuth + a **mobile-local data layer** mirroring
  web. Extracting a shared `packages/data` is deferred to the billing slice.
- **Free tier:** the `Birth` and `Now` views. Within them, **Clock (12h/24h), Theme
  (Light/Dark/Auto + day-night sky), and Aspects (Major/Minor) stay free.** The **Glyphs / VisGrid**
  per-planet customization is **Pro**.
- **Pro tier:** everything else — `Date`, `Range`, `Compare` views (and future Synastry) + the
  Glyphs/VisGrid. Monthly and annual both resolve to a single `isPro` (the gate doesn't care which).
- **Edit throttle:** Free users may change birth details **3 times per rolling 30 days**; Pro is
  unlimited. The **first save** and the **first-login local→DB migration** are exempt (they are not
  "changes"). Signed-in users are enforced **server-side** (authoritative); logged-out users get a
  **client-side speed-bump** only (bypassable by reinstall — accepted).
- **One spec, five phases** (§3). Each phase is separately shippable/testable; we may split into
  separate plans at writing-plans time.

---

## 3. Phasing (dependency-ordered)

1. **Mobile auth + Supabase client** — sign in/up/out, session persistence, account screen.
2. **Birth-chart sync** — shared `birth_charts` read/write + `iana_tz` migration (both platforms).
3. **Entitlement read** — `isPro` from `subscriptions`; Pro/Free badge (both platforms).
4. **Feature gating** — gate views + Glyphs by `isPro` (both platforms) + upgrade prompts.
5. **Birth-form edit throttle** — 3/30-day for Free (both platforms), server-authoritative.

Phases 1–3 are prerequisites for 4. Phase 5 is independent of 4 (depends on 1–2).

---

## 4. Architecture

### 4.1 Supabase client — `apps/mobile/lib/supabase.ts`

`@supabase/supabase-js` configured for React Native:

- `import "react-native-url-polyfill/auto";` at the top (supabase-js needs the URL polyfill in RN).
- `createClient(url, anonKey, { auth: { storage: AsyncStorage, persistSession: true,
  autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" } })`.
- An `AppState` listener toggles `supabase.auth.startAutoRefresh()` / `stopAutoRefresh()` on
  foreground/background (the documented RN pattern).
- Env (Expo public): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` — same project as
  web. No service-role key ever ships in the app.
- **Polyfill note:** PKCE uses `crypto.getRandomValues`; if the runtime lacks it, add
  `react-native-get-random-values`. Confirm during implementation.

### 4.2 Auth — `apps/mobile/lib/auth.tsx` + `apps/mobile/components/auth/`

- **`AuthProvider` / `useAuth()`** (`lib/auth.tsx`): holds `{ session, user, loading }`, subscribes
  to `supabase.auth.onAuthStateChange`, and exposes `signUp`, `signInWithPassword`,
  `signInWithGoogle`, `signOut`. Wraps the app at the root (outside `ThemeProvider` is fine).
- **Email/password:**
  - `signUp({ email, password, options: { data: { name } } })` → "check your email to confirm"
    state. The confirm link opens the **web** callback (the shared project's Site URL), which
    confirms the account server-side; the user returns to the app and signs in.
  - `signInWithPassword({ email, password })`.
  - Live password policy mirrors web (≥ 8, ≥ 1 letter, ≥ 1 number): a pure
    `apps/mobile/lib/password.ts` `validatePassword`, kept in lockstep with web's `lib/password.ts`
    and pinned by a unit test on each side.
- **Google (browser OAuth):**
  - `const redirectTo = Linking.createURL("auth-callback")` (requires a `scheme` in `app.json`,
    e.g. `"movestar"`).
  - `const { data } = await supabase.auth.signInWithOAuth({ provider: "google",
    options: { redirectTo, skipBrowserRedirect: true } });`
  - `const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);`
  - On `res.type === "success"`, parse `?code` from `res.url` and
    `await supabase.auth.exchangeCodeForSession(code);`. User-cancel is a no-op.
  - The redirect URL must be added to the Supabase Auth **redirect allowlist** (§10).
- **Screens** (`components/auth/`):
  - `LoginScreen.tsx` — a sheet/modal with a Sign-in ⇄ Create-account toggle, email/password fields
    with live validation, and a Google button (mirrors the web single-route shape).
  - `AccountView.tsx` — email, display name, the **Pro/Free badge**, and **Sign out**.
- **Header affordance** (`App.tsx`): logged-out → a "Sign in" entry; logged-in → opens Account.
  (The existing avatar still opens the birth form.)

### 4.3 Birth-chart sync — `apps/mobile/lib/birthCharts.ts`

Mirrors the web `apps/web/lib/birthCharts.ts` mapping (1:1 primary chart per user):

| `BirthData` | column | type |
|---|---|---|
| name? | name | text |
| date | birth_date | date |
| time | birth_time | time |
| tzOffset | tz_offset | numeric |
| isDst | is_dst | boolean |
| lat | lat | numeric |
| lon | lon | numeric |
| placeLabel? | place_label | text |
| **ianaTz?** | **iana_tz** | **text (new — §7)** |

- `rowToBirth(row)`, `birthToRow(birth, userId)` (`is_primary: true`),
  `getPrimaryBirthChart(supabase)`, `upsertPrimaryBirthChart(supabase, birth)` (select-existing-
  primary → update-by-id else insert — same app-logic upsert as web).
- **Source-of-truth rule:** logged-in → Supabase is authoritative, `birthStore.ts` (AsyncStorage)
  stays as a cache; logged-out → AsyncStorage only (today's behavior, unchanged).
- **First-login migration:** when a session appears AND the account has **no** primary chart AND
  AsyncStorage holds a birth → upsert it once (exempt from the throttle, §4.6).
- **`App.tsx` wiring:** on session present, load the primary chart from the DB and seed `birth`
  (falling back to the migration or the local cache); `onSave` routes to
  `upsertPrimaryBirthChart` + cache when logged-in, else cache only.

### 4.4 Entitlement read — `apps/mobile/lib/entitlement.ts` (+ web parity)

- Pure: `entitlementFromRow(row): { isPro, status, periodEnd }` where
  `isPro = ["active","trialing"].includes(status) && periodEnd != null && periodEnd > now`.
- Fetch: read the caller's single `subscriptions` row (RLS already allows owner SELECT).
- Held on the auth context and read via a `useEntitlement()` selector so the badge and the gate
  share one value. Defaults to **Free** when logged-out or no row.
- **Forward-compatible:** when the billing slice introduces an `entitlements` table, only the fetch
  changes — `isPro` and every consumer stay the same.
- **Web parity:** the web already fetches `subscriptions` server-side; expose the same derived
  `isPro` to `Chart.tsx` / `Panel.tsx`. Factor the derivation so web and mobile use identical logic
  (the pure `entitlementFromRow` is duplicated per platform and kept in lockstep, pinned by a unit
  test on each side — the same approach used for the ported `chartModel`).

### 4.5 Feature gating (web + mobile)

`isPro` is the single source of truth on each platform. A small reusable gate:

- **Mobile:** pass `isPro` into `ChartControls`. Gate two surfaces:
  - **View switcher** — `Date`/`Range`/`Compare` options render with a **Pro lock**; tapping a
    locked mode does not switch, it opens the upgrade prompt. Free users are pinned to
    `Birth`/`Now`. If a persisted/restored mode is locked, fall back to `birth`.
  - **Glyphs section** — the `VisGrid` renders locked (disabled chips + Pro lock); tapping opens the
    upgrade prompt. Clock/Theme/Aspects render normally for Free.
  - **Upgrade prompt** — a `ProUpgradeSheet` (BottomSheet): "Subscribe on the web to unlock Pro" with
    the web URL (deep-linkable later). No in-app purchase this slice.
- **Web:** pass `isPro` into `Panel.tsx`. Gate the same surfaces — the `View` `ToggleButtonGroup`
  Pro modes and the `Glyphs` fieldset show a lock; the prompt routes to the **existing Stripe
  checkout** (`/api/stripe/checkout`) or `/account`.
- **Enforcement level:** gating is **UX/entitlement**, not a security boundary — the chart math runs
  client-side from a public ephemeris, so there is no server secret to protect. Client gating is
  therefore sufficient for views/Glyphs. (The one thing that needs server teeth is the edit
  throttle, §4.6, because it guards against free chart-shopping.)

### 4.6 Birth-form edit throttle (web + mobile)

Stops Free users from repeatedly rewriting birth data to chart-shop.

- **Rule:** Free = **3 changes / rolling 30 days**; Pro = unlimited. A "change" = saving the birth
  form when a primary chart already exists. The **first save** and the **first-login migration** do
  not count.
- **Server-authoritative (signed-in):** an append-only audit table
  `birth_edits(user_id, edited_at)` (RLS: owner SELECT + INSERT). Before an update, count rows in
  the last 30 days; if `>= 3`, block. A **Postgres trigger** on `birth_charts UPDATE`
  (`SECURITY DEFINER`) is the real backstop — it recomputes the count, checks Pro via
  `subscriptions`, and raises if a non-Pro user exceeds the window, so the limit holds even if the
  REST API is called directly. The client check is for UX (disable Save early); the trigger is the
  wall.
- **Client speed-bump (logged-out):** a small counter in AsyncStorage (mobile) / localStorage (web)
  — `{ count, windowStart }`. Deterrent only; bypassable by clearing storage / reinstall (accepted).
- **UX:** at the limit, the form's **Save disables** with "You can change your birth details again in
  N days," where N derives from the oldest edit in the window. The error surfaces non-fatally if the
  trigger rejects an update the client thought was allowed (clock skew, direct API).

---

## 5. Components / boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `apps/mobile/lib/supabase.ts` | configured RN client + AppState refresh | supabase-js, AsyncStorage |
| `apps/mobile/lib/auth.tsx` | AuthProvider/context; sign in/up/out | supabase client |
| `apps/mobile/lib/password.ts` | pure password policy, lockstep w/ web | — |
| `apps/mobile/lib/birthCharts.ts` | row↔BirthData mapping + fetch/upsert | supabase client, engine `BirthData` |
| `apps/mobile/lib/entitlement.ts` | subscriptions row → `{ isPro, … }` (pure + fetch) | supabase client |
| `apps/mobile/lib/editThrottle.ts` | rolling-window count + "days until next" (pure) + client counter | AsyncStorage |
| `apps/mobile/components/auth/LoginScreen.tsx` | email/pw + Google UI + validation | auth, password |
| `apps/mobile/components/auth/AccountView.tsx` | email, name, badge, sign out | auth, entitlement |
| `apps/mobile/components/ProUpgradeSheet.tsx` | upgrade prompt (mobile → "subscribe on web") | — |
| `apps/mobile/components/chart/ChartControls.tsx` | gate View modes + Glyphs by `isPro` | entitlement |
| `apps/mobile/components/BirthForm.tsx` | enforce throttle in Save | editThrottle, birthCharts |
| `apps/mobile/App.tsx` | wrap in AuthProvider; seed birth from DB; gate; header affordance | all above |
| `apps/web/lib/entitlement.ts` | identical `isPro` derivation (lockstep w/ mobile) | — |
| `apps/web/components/Chart/Panel.tsx` + `Chart.tsx` | gate Pro views + Glyphs; upgrade → checkout | entitlement |
| `apps/web/components/Chart/BirthForm.tsx` | enforce throttle in apply | birth_edits, throttle helper |
| `supabase/migrations/*` | `iana_tz` column; `birth_edits` table + RLS + throttle trigger | — |

## 6. Data flow

- **Anonymous (today):** birth ↔ AsyncStorage; chart renders; no network; Free gate; client edit
  counter.
- **Sign in:** session set → load primary chart from DB (or migrate the local chart up if the
  account is empty) → seed `birth` → fetch entitlement → badge + gate update.
- **Edit birth while logged-in:** client pre-check (throttle) → `upsertPrimaryBirthChart` →
  `birth_edits` insert (trigger re-validates) → update cache.
- **Sign out:** clear session → fall back to AsyncStorage cache → badge/gate revert to Free.

## 7. Database migrations

Delivered as files under `supabase/migrations/` (GitHub integration applies on push), never
hand-edits to a live DB:

1. `<ts>_birth_charts_iana_tz.sql` — `alter table public.birth_charts add column if not exists
   iana_tz text;`. Thread `iana_tz` ↔ `ianaTz` through **both** the mobile and web `birthCharts`
   mappings so the per-chart zone survives a cross-platform round-trip (and the EST/CDT birth label
   stays correct).
2. `<ts>_birth_edits.sql` — create `public.birth_edits (id uuid pk default gen_random_uuid(),
   user_id uuid not null references auth.users on delete cascade, edited_at timestamptz not null
   default now())`; index on `(user_id, edited_at)`; enable RLS; owner SELECT + INSERT policies.
3. `<ts>_birth_edit_throttle_trigger.sql` — a `SECURITY DEFINER` function + `BEFORE UPDATE` trigger
   on `birth_charts` that, for non-Pro users (checked against `subscriptions`), counts
   `birth_edits` in the last 30 days and `raise exception` when the 4th change in the window is
   attempted; otherwise inserts the audit row. (Exact SQL drafted in the plan.)

## 8. Error handling

- **Login:** generic "Invalid email or password" (don't reveal which field). **Signup:** surface
  "email already registered", weak-password (caught client-side first), and the "check your email"
  success state; handle "email not confirmed" on login.
- **Google:** user-cancel → silent no-op; redirect/exchange failure → inline message.
- **Sync failures are non-fatal** — keep the AsyncStorage cache, show a small inline notice, the
  chart keeps working. Offline → local-only, reconcile on next foreground.
- **Throttle rejection** (trigger fires) → show the "change again in N days" message; never crash.
- All async boundaries use try/catch with user-friendly copy; no swallowed errors.

## 9. Testing

- **Unit (`node --test`, mobile + engine):**
  - `birthToRow`/`rowToBirth` round-trip **including `iana_tz`** on the reference birth
    (`1992-07-29 / 14:28 / -6 / dst / America/Chicago`).
  - `entitlementFromRow` boundaries: active/trialing/past_due/canceled × period-end past/future/null.
  - `editThrottle`: count-in-window and days-until-next at boundaries (0/2/3 edits; window edges).
  - `validatePassword` boundaries (7/8 chars, letter-only, number-only, valid).
- **Expo Go (device/web):** email sign-up → confirm → login; sign-out; birth edit persists across
  reload from DB; first-login local→DB migration; badge reflects a manually-set `subscriptions`
  row; Free gate hides Date/Range/Compare + locks Glyphs; throttle blocks the 4th edit in 30 days.
- **Google OAuth:** needs an EAS dev build (or the Expo auth proxy) + the live project — device-only.
- **Web:** Pro gate on `Panel` (locked views/Glyphs → checkout); throttle via the trigger; existing
  suites stay green.

## 10. External setup (user — I cannot do these)

1. Mobile `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (same project as web).
2. Add the app deep-link redirect(s) to the Supabase Auth **redirect allowlist**
   (`movestar://auth-callback` + the Expo dev URLs).
3. Apply the three migrations (§7) via the GitHub integration / `supabase db push`.
4. For reliable Google deep-linking, produce an **EAS dev build** (email+password is testable in
   Expo Go without one).
5. Confirm the web Stripe products expose monthly **and** annual prices (the gate only needs
   `isPro`, but the upgrade CTA should offer both).

## 11. Security notes

- Anon key only on device; RLS owner-only policies on `birth_charts` / `subscriptions` /
  `birth_edits` are the real guard. Service-role key never ships.
- Session auto-refresh via the SDK; tokens live in AsyncStorage (standard Supabase RN pattern).
- The edit-throttle trigger is `SECURITY DEFINER` with a fixed `search_path`.
- Feature gating is UX-level by design (no server secret behind the chart); the throttle is the only
  abuse-facing control and is enforced in the database.

## 12. Out of scope (later slices)

Mobile in-app purchase / checkout (the billing slice, §13); Apple "Sign in with Apple"; the native
Google Sign-In SDK; password reset / magic link; multiple saved charts; profile editing beyond name;
extracting a shared `packages/data`.

## 13. Related

`docs/research/2026-06-02-cross-platform-billing-scope.md` — the future billing slice. This slice
ships its **P1 foundation** (the account-scoped entitlement *read*), so a web/Stripe subscriber is
instantly Pro on mobile. The mobile *purchase* path (RevenueCat + Play Billing) and the unified
`entitlements` table arrive there; this design keeps `entitlement.ts` swap-ready for it.
