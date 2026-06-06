# Sign-in Gate + Signed-out "Now" Placeholder — Design

**Date:** 2026-06-03
**Author:** moosedavis + Claude
**Status:** Approved (brainstorm); pending implementation plan
**Implements:** memory `access-tiers-gating` (the 3-tier model). Part 1 (the sign-in gate +
anonymous placeholder + Free/Pro gating UI) of that model. Builds on the Free/Pro split and the
P3 entitlement-read / P4 gating designs in
`docs/specs/2026-06-02-mobile-accounts-entitlement-gating-design.md` (neither was implemented).

---

## 1. Goal & scope

Gate the mobile app by **three tiers** and turn the signed-out experience into a live
"current-sky" teaser:

- **Anonymous (signed-out):** only the **Now** view (live current-sky chart), **no controls
  panel**, a prompt to sign in. Cannot enter a birth chart or see the Birth view.
- **Free (signed-in):** enter a birth chart; **Birth + Now** views; **Clock / Theme / Aspects**
  controls. **Date / Range / Compare** views and **Glyphs/VisGrid** are Pro (shown locked).
- **Pro (subscribed):** everything unlocked.

**This slice builds the gate + the entitlement *read* + the placeholder upgrade UI. It does NOT
build the subscription *purchase* flow** (Play Billing vs web Stripe) — that is a separate,
deferred design. With no purchase path yet, signed-in users are Free and see Pro locked (expected).

---

## 2. Decisions (locked)

- **Tier = `anonymous` | `free` | `pro`**, derived as: `!session → anonymous`; else
  `isPro ? pro : free`. `isPro` comes from the user's `subscriptions` row.
- **Anonymous = Now-only.** Force `clock.mode = "now"`; hide the bottom Controls panel entirely.
- **Anonymous wheel shows the live sky only** — the **natal layer is hidden** (no birth chart
  exists; drawing the default birth would mislead).
- **Anonymous Big Three = live ☉ Sun + ☽ Moon** for the now moment (updates as signs change).
  **No Ascendant** — it needs an exact birth time + place, so it unlocks once the user enters
  their birth chart. Signed-in users keep their **birth** Big Three (today's behavior).
- **Sign-in prompt** on the anonymous view: a tappable pill below the chart,
  **"Sign in to chart your birth →"**, opening the login sheet.
- **Avatar menu (`HeaderMenu`)** shows **only "Sign in"** when signed out (no "Edit birth
  details"); signed in shows "Account" + "Edit birth details".
- **Pro-locked UI:** locked modes (Date/Range/Compare) and the Glyphs/VisGrid section render with
  a small lock; tapping opens a placeholder **`ProLockSheet`** whose copy is
  **"Unlock more cool features with Pro!"** (plus a short list of what Pro includes). No purchase
  button yet.
- **Purchase flow is out of scope** (deferred — see §8).

---

## 3. Architecture

### 3.1 Entitlement read — `apps/mobile/lib/entitlement.ts` (new)

- Pure: `entitlementFromRow(row): { isPro: boolean }` where
  `isPro = ["active","trialing"].includes(row?.status) && row?.current_period_end != null &&
  Date.parse(row.current_period_end) > Date.now()`. Returns `{ isPro: false }` for a null row.
- Fetch: read the caller's single `subscriptions` row (RLS already allows owner SELECT) when a
  session is present; default Free when logged-out or no row.
- Exposed from the auth layer (held alongside `session`) and read via a `useEntitlement()`
  selector, OR computed in `App.tsx` from a one-shot fetch on session change. Forward-compatible:
  when the billing slice lands, only the fetch source changes; `isPro` and consumers stay the same.

### 3.2 Tier + gating in `App.tsx`

- Derive `tier` from `session` + `isPro`.
- **Force Now when anonymous:** an effect — `if (!session) clock.setMode("now")`.
- **Big Three** is conditional:
  - anonymous → `☉ ${signOf(livePos.sun)}   ☽ ${signOf(livePos.moon)}` (no Asc; tracks Now).
  - signed in → existing birth Big Three (`☉/☽/↑` from natal + ascendant).
- **Wheel:** pass `showNatal={tier !== "anonymous"}` to `ChartWheel` (live-only sky when anonymous).
- **Controls:** render the `BottomSheet`/`ChartControls` only when `session` is present. Anonymous
  sees no panel.
- **Sign-in prompt:** when anonymous, render `<SignInPrompt onPress={() => setAuthView("login")} />`
  in the stage (below the chart).
- **Menu:** pass `signedIn={!!session}` to `HeaderMenu` (already present); `HeaderMenu` hides
  "Edit birth details" when not signed in.

### 3.3 `ChartWheel` — `showNatal?: boolean` (default true)

- When `false`, skip rendering the `NatalLayer` (and any natal-only axes), drawing the live
  (`LiveLayer`) sky + dial only. Used by the anonymous Now view.

### 3.4 Pro gating in `ChartControls`

- Accept `isPro: boolean` (controls only render when signed in).
- **Mode switcher:** `Birth` and `Now` are always enabled (Free). `Date`, `Range`, `Compare`
  render with a lock; tapping a locked mode does **not** switch — it opens `ProLockSheet`.
- **Glyphs/VisGrid section:** when `!isPro`, render locked (disabled rows + lock); tapping opens
  `ProLockSheet`. `Clock`, `Theme`, `Aspects` stay enabled for Free.
- A persisted/restored Pro mode while Free falls back to `birth`.

### 3.5 New presentational components

- `components/SignInPrompt.tsx` — a themed pill/button ("Sign in to chart your birth →").
- `components/ProLockSheet.tsx` — a themed modal/sheet: heading **"Unlock more cool features with
  Pro!"**, a short line listing Pro features (Date, Range, Compare views + Glyphs), and a Close
  button. A "Subscribe" CTA is intentionally absent until the billing slice.

---

## 4. Components / boundaries

| Unit | Responsibility | Depends on |
|---|---|---|
| `apps/mobile/lib/entitlement.ts` (+ test) | pure `entitlementFromRow` + fetch of the subscriptions row | supabase client |
| `apps/mobile/lib/auth.tsx` (or a selector) | expose `isPro` alongside `session` | entitlement, supabase |
| `apps/mobile/App.tsx` | derive tier; force-now + conditional bigThree/natal/controls/prompt | auth, entitlement, useChartClock |
| `apps/mobile/components/chart/ChartWheel.tsx` | `showNatal` prop to hide the natal layer | — |
| `apps/mobile/components/chart/ChartControls.tsx` | lock Pro modes + Glyphs by `isPro`; open ProLockSheet | entitlement |
| `apps/mobile/components/SignInPrompt.tsx` (new) | anonymous "sign in" pill | theme |
| `apps/mobile/components/ProLockSheet.tsx` (new) | placeholder Pro teaser ("Unlock more cool features with Pro!") | theme |
| `apps/mobile/components/HeaderMenu.tsx` | hide "Edit birth details" when signed out | (prop already present) |

## 5. Data flow

- **Launch, signed out:** no session → tier=anonymous → mode forced Now → wheel shows live sky
  (no natal) → bigThree = live Sun+Moon → no controls → SignInPrompt shown → menu = "Sign in".
- **Sign in (no sub):** session appears → fetch subscriptions → `isPro=false` → tier=free →
  controls render (Date/Range/Compare + Glyphs locked) → can enter birth → bigThree = birth.
- **Pro (sub active):** `isPro=true` → tier=pro → everything unlocked.
- **Tap a locked Pro feature (Free):** opens `ProLockSheet`; no mode change.
- **Sign out:** session clears → revert to anonymous (Now-only placeholder).

## 6. Error handling

- Entitlement fetch failure → default **Free** (never crash; never falsely grant Pro). Logged,
  not swallowed silently.
- Forcing Now on sign-out must not fight the user: only force when `!session` (signed-in users
  switch modes freely within their tier).
- `ProLockSheet` / `SignInPrompt` are presentational; no async, no failure paths.

## 7. Testing

- **Unit (`node --test --experimental-strip-types "lib/*.test.ts"`, pure only):**
  - `entitlementFromRow`: active/trialing × period-end future/past/null → isPro true/false; null row → false.
  - A pure `tierOf(session, isPro)` helper (if extracted) → anonymous/free/pro.
- **Manual QA (device/emulator):**
  1. Signed out → only Now; no controls; wheel shows live sky (no natal); bigThree = live Sun+Moon (no Asc); "Sign in to chart your birth →" prompt; menu shows only "Sign in".
  2. Watch the Now bigThree update as the moment advances (Moon sign changes at a boundary).
  3. Sign in → controls appear; Birth + Now work; Date/Range/Compare + Glyphs locked → tapping opens "Unlock more cool features with Pro!"; can enter birth; bigThree = birth.
  4. (If a `subscriptions` row is manually set active) → Pro unlocks everything.
  5. Sign out → reverts to the anonymous placeholder.

## 8. Out of scope (later slices)

The **subscription purchase flow** (Google Play Billing vs web Stripe, plus the App/Play-store
policy decision) and any real "Subscribe" CTA. The `subscriptions` write path / webhook. Apple
Sign-In on web. Per-platform billing lives in the billing slice; this design keeps `entitlement.ts`
swap-ready for it.

## 9. Related

- Memory `access-tiers-gating`, `cross-platform-account-sync`, `launch-order-platforms`.
- `docs/specs/2026-06-02-mobile-accounts-entitlement-gating-design.md` — the Free/Pro split + P3/P4
  designs this implements (with the new anonymous tier added on top).
