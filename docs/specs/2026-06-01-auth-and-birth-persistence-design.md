# Auth + Birth-Data Persistence — Design

**Date:** 2026-06-01
**Author:** moosedavis + Claude
**Status:** Approved (brainstorm); pending implementation plan
**Implements:** MVP build-order step 3 ("Supabase schema + auth + birth-form persistence"),
auth half of `2026-05-31-web-mvp-design.md`.

---

## 1. Goal

Let users sign up / sign in with **email + password** (with password validation) and with
**Google OAuth**, and persist each user's **birth chart** to their account. The free natal
chart must keep working with no login (freemium); auth gates the account area and, later,
checkout.

## 2. Decisions (locked)

- **Provider:** Supabase Auth (`@supabase/ssr`, already installed). PKCE flow.
- **Email verification:** ON. Signup sends a confirm link; the user must confirm before the
  first password login. (OAuth users are confirmed by the provider.)
- **Password policy:** ≥ 8 chars, ≥ 1 letter, ≥ 1 number. Enforced live in the form
  (`lib/password.ts`) AND mirrored in the Supabase dashboard policy (server is the real gate).
- **Gating:** `/chart` + landing stay public. `/account` (and later checkout) require login.
  Row-Level Security (already in `schema.sql`) is the true data guard; middleware is UX only.
- **Slice scope:** auth + birth-data persistence. (Paywall gating of paid views and the
  Stripe billing flow are later slices.)
- **Auth UI shape:** one `/login` route with a Sign in / Create account toggle + Google
  button (not separate pages, not a modal).

## 3. Architecture

### 3.1 Auth flow
- `app/login/page.tsx` renders `LoginForm.tsx` (client component, browser Supabase client):
  - **Sign up:** `auth.signUp({ email, password, options: { emailRedirectTo:
    ${SITE_URL}/auth/callback?next=/chart, data: { name } } })` → "check your email" state.
  - **Sign in:** `auth.signInWithPassword({ email, password })` → redirect to `next` (default `/chart`).
  - **Google:** `auth.signInWithOAuth({ provider: 'google', options: { redirectTo:
    ${origin}/auth/callback?next=/chart } })`.
- `app/auth/callback/route.ts` (GET): exchanges `?code` for a session
  (`auth.exchangeCodeForSession`) — handles BOTH the email-confirm link and the OAuth return —
  then `redirect(next)`. On failure, `redirect('/login?error=...')`.
- `app/auth/signout/route.ts` (POST): `auth.signOut()` → redirect `/`.

### 3.2 Session + route protection
- `middleware.ts` + `lib/supabase/middleware.ts` (`updateSession`): refresh the auth cookie on
  every request via `auth.getUser()` (validated, not `getSession()`), and:
  - unauthenticated request to a protected path (`/account`, `/account/*`) → redirect
    `/login?next=<path>`.
  - all other paths pass through. Matcher excludes static assets / `_next` / images.

### 3.3 Password validation
- `lib/password.ts`: `validatePassword(pw: string): { ok: boolean; problems: string[] }`
  — pure, checks length ≥ 8, has letter, has number. Used by `LoginForm` for live feedback
  and submit-blocking. Server-side policy in Supabase mirrors this.

### 3.4 Birth-data persistence
- **Mapping** (`lib/birthCharts.ts`), `BirthData` ↔ `birth_charts` row (1:1):
  | BirthData    | column        | type    |
  |--------------|---------------|---------|
  | name?        | name          | text    |
  | date         | birth_date    | date    |
  | time         | birth_time    | time    |
  | tzOffset     | tz_offset     | numeric |
  | isDst        | is_dst        | boolean |
  | lat          | lat           | numeric |
  | lon          | lon           | numeric |
  | placeLabel?  | place_label   | text    |
  - `rowToBirth(row): BirthData`, `birthToRow(birth, userId): InsertRow` (always `is_primary: true`).
  - `getPrimaryBirthChart(supabase): BirthData | null`, `upsertPrimaryBirthChart(supabase, birth)`.
    `upsertPrimaryBirthChart` does **select-existing-primary → update-by-id, else insert**
    (app-logic upsert). This is robust regardless of whether PostgREST can target the partial
    unique index for `ON CONFLICT`; the index in §3.4 is a data-integrity backstop, not the
    upsert mechanism.
- **Flow:**
  - `app/chart/page.tsx` → Server Component: read session; if logged in, fetch the user's
    primary `birth_charts` row; pass `userId` + `initialBirth` into `<Chart>`.
  - `Chart.tsx`: new optional props `userId?: string | null`, `initialBirth?: BirthData | null`.
    - Mount: if `initialBirth` → seed birth from it; else read `localStorage["astroBirth"]`
      (anonymous path unchanged — the free chart works logged out).
    - `applyBirth`: if `userId` → `upsertPrimaryBirthChart` (browser client, RLS-scoped) and
      keep the localStorage cache; else localStorage only.
    - **Migration on first login:** if `userId` && `initialBirth == null` && localStorage has a
      birth → upsert it once as the user's primary chart.
- **DB:** tables/RLS/profile-trigger already exist in `schema.sql`. One additive change: a
  partial unique index to make the primary-chart upsert clean —
  `create unique index birth_charts_one_primary on public.birth_charts (user_id) where is_primary;`
  Delivered as a **migration** (see §6), not an edit to `schema.sql`.

### 3.5 Account + nav affordance
- `app/account/page.tsx` (Server Component, protected): show email + display name + a
  **Sign out** button (form POST to `/auth/signout`).
- `Panel.tsx` identity block: replace the hardcoded `@doosemavis` with an auth affordance —
  "Sign in" link (→ `/login`) when logged out, or the user's email + an "Account" link when
  logged in. Chart page passes `userEmail: string | null` down.

## 4. Components / boundaries

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `lib/password.ts` | pure password policy | — |
| `lib/birthCharts.ts` | row↔BirthData mapping + fetch/upsert | supabase client, engine `BirthData` |
| `lib/supabase/middleware.ts` | refresh session, expose user | `@supabase/ssr` |
| `middleware.ts` | route protection | `lib/supabase/middleware` |
| `app/auth/callback` | code→session exchange | server supabase client |
| `app/auth/signout` | sign out | server supabase client |
| `app/login` + `LoginForm` | auth UI + validation | browser client, `lib/password` |
| `app/account` | account view + sign out | server supabase client |
| `app/chart/page` | load session + primary chart, pass to Chart | server client, `lib/birthCharts` |
| `Chart.tsx` | use initialBirth/userId; save via Supabase or localStorage | browser client, `lib/birthCharts` |

## 5. Error handling

- Login: generic "Invalid email or password" (don't reveal which field).
- Signup: surface "email already registered", weak-password (caught client-side first),
  and the "check your email to confirm" success state. Handle "email not confirmed" on login.
- OAuth / callback failures: redirect to `/login?error=<message>`; render the message.
- Birth upsert failure: non-fatal — keep localStorage cache, show a small inline notice; the
  chart keeps working.

## 6. Database migrations + GitHub integration

- New dir `supabase/migrations/`. The Supabase **GitHub integration** applies migrations on
  push, so all future schema changes are migration files here (never hand-edits to a live DB).
- This slice adds `supabase/migrations/<timestamp>_birth_charts_one_primary.sql` (the partial
  unique index in §3.4).
- The existing `schema.sql` is the baseline. When the GitHub integration is wired, convert it
  to an initial migration (`<timestamp>_init.sql`) OR apply it once as the baseline, then let
  migrations carry deltas forward. (User to set up the integration + provide project context.)

## 7. External setup (user — I cannot do these)

1. Supabase project; `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; apply baseline schema.
2. Auth settings: email confirmation ON; Site URL + redirect allowlist
   (`http://localhost:3000/**` + prod); password policy (min 8, letters + numbers).
3. Google: OAuth client in Google Cloud (redirect URI
   `https://<project>.supabase.co/auth/v1/callback`) → enable Google provider in Supabase
   with client ID + secret.
4. Wire the GitHub → Supabase integration for migrations.

## 8. Testing

- **Unit:** `validatePassword` (boundaries: 7/8 chars, letter-only, number-only, valid);
  `rowToBirth`/`birthToRow` round-trip on the reference birth (`1992-07-29 / 14:28 / -6 / dst`).
- **UI / logic (browse, dev server):** `/login` renders; live password validation; submit
  blocked on weak pw; protected `/account` redirects to `/login` when logged out; logged-out
  `/chart` still renders the free wheel. (These don't need a live Supabase project.)
- **Live round-trip (needs the user's Supabase project):** real signup → confirm email →
  login; Google sign-in; sign-out; birth edit persists across reload from DB; first-login
  localStorage→DB migration.

## 9. Security notes

- Anon key client-side (RLS-scoped); service-role key server-only (already isolated to the
  webhook helper). Never expose service role to the browser.
- Middleware auth check uses `getUser()` (server-validated), not `getSession()`.
- RLS owner-only policies on `birth_charts` are the real guard; client gating is convenience.
- PKCE for OAuth + email links.

## 10. Out of scope (later slices)

- Paywall gating of paid views (`entitlements()` wired into the Chart).
- Stripe billing flow (checkout / webhook / portal / customer portal).
- Password reset / magic-link, multiple saved charts, profile editing UI.
