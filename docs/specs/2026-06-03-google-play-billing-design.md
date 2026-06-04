# Google Play Billing (Pro subscription) — Design Spec

**Date:** 2026-06-03
**App:** MoveStar mobile (`apps/mobile`) — Expo SDK 54 / React Native 0.81 / React 19 / TypeScript, pnpm workspace, Expo dev build (not Expo Go).
**Status:** Approved design; ready for an implementation plan.

## Goal

Let a **signed-in Free user** purchase the **monthly** or **yearly Pro** subscription through Google Play, have the purchase verified by RevenueCat, mirrored into the Supabase `public.subscriptions` table, and have the app's `isPro` flip to `true` instantly. Pro then unlocks Date / Range / Compare modes and Glyph customization, per the existing 3-tier gating (anonymous / free / pro), which is already implemented and correct.

## Scope

**In scope (this slice):**
- Google Play subscriptions: **monthly + yearly**, each with a **3-day free trial**.
- RevenueCat SDK (`react-native-purchases`) + **prebuilt paywall** (`react-native-purchases-ui`).
- RevenueCat → Supabase **webhook** (Edge Function) that mirrors entitlement into `public.subscriptions`.
- Provider-agnostic `subscriptions` schema.
- Entitlement lifecycle: instant unlock, foreground refresh, downgrade clamp.

**Out of scope (deferred, but schema-ready):**
- Apple In-App Purchase.
- Web payments (Stripe).

**Launch order:** Google Play first → web (Stripe) second → Apple last. One Supabase DB across all platforms.

## Architecture

```
                          ┌─────────────────────────────┐
   ┌──── taps Upgrade ───▶│  RevenueCatUI paywall (app)  │
   │                      └──────────────┬──────────────┘
[MoveStar app]                           │ purchasePackage()
   │  Purchases.logIn(supabase user id)  ▼
   │                            ┌───────────────────┐  verifies token   ┌────────────┐
   │◀── instant CustomerInfo ───│   RevenueCat      │◀─────────────────▶│ Google Play│
   │     (pro entitlement)      │ (source of truth) │                   └────────────┘
   │                            └────────┬──────────┘
   │                                     │ webhook (every state change)
   │                                     ▼
   │                        ┌─────────────────────────────┐
   │                        │ Supabase Edge Function       │  (verifies shared secret)
   │                        │ "revenuecat-webhook"         │
   │                        └──────────────┬──────────────┘
   │                                       │ upsert (service role)
   │                                       ▼
   └──────────────────────────▶  public.subscriptions  (durable record + web source of truth)
```

**Key decisions:**

1. **Identity link.** On sign-in the app calls `Purchases.logIn(session.user.id)`, so the RevenueCat *App User ID* **is** the Supabase user id. The webhook therefore always knows which `subscriptions.user_id` to write. On sign-out, `Purchases.logOut()`.
2. **Two entitlement signals, reconciled.** The RevenueCat SDK `CustomerInfo` is the **instant, offline-cached in-app gate** (Pro unlocks the moment a purchase succeeds). The Supabase `subscriptions` table is the **durable record** kept fresh by the webhook, and remains the source of truth for the future web app (which has no mobile SDK). Both derive from RevenueCat, so they cannot disagree for long.
3. **Scope = Google Play only, now.** The schema is made provider-agnostic in this slice so Apple and web-Stripe slot in later with no further migration.

## Money & data flow (important: RevenueCat never holds money)

RevenueCat is a **data / entitlement layer**, not a payment processor or payout channel.

| | Who collects the money | Who pays your bank | Role of RevenueCat |
|---|---|---|---|
| **Mobile (Play)** | Google | **Google → your bank** (Play Console payments profile) | Tracks the sale, syncs entitlement → Supabase. No money. |
| **Apple (later)** | Apple | **Apple → your bank** (App Store Connect banking) | Same — data only |
| **Web (later)** | Stripe | **Stripe → your bank** | Optional; can mirror Stripe → Supabase directly |

- **All apps write into the one `subscriptions` table** (that is the point of the provider-agnostic schema): mobile via RevenueCat's webhook now; web via Stripe's webhook later. Unified entitlement record.
- **Payouts** come from **Google** (mobile) and **Stripe** (web), *not* RevenueCat. There is no "cash out from RevenueCat." You must configure a **Google Play Console payments/merchant profile** (bank details) to receive Play revenue.

## Schema

Make `public.subscriptions` provider-agnostic **without changing the read path** — `entitlement.ts` and `useEntitlement` only read `status` and `current_period_end`, which stay the canonical, provider-neutral entitlement fields.

Current table: `user_id` PK → `auth.users`, `stripe_customer_id`, `stripe_subscription_id`, `status`, `price_id`, `current_period_end`, `updated_at`. RLS: `subs_self_select` (owner read), **no** client write policy.

Migration (`supabase/migrations/20260603xxxxxx_subscriptions_provider_agnostic.sql`):

```sql
alter table public.subscriptions
  add column if not exists provider   text,   -- 'play' | 'stripe' | 'apple'
  add column if not exists product_id text;   -- generic product purchased (RC product id)

update public.subscriptions
  set provider = 'stripe'
  where provider is null and stripe_subscription_id is not null;
```

- The Stripe-specific columns are **kept** (nullable) for the future web flow; Play rows leave them null.
- **No RLS change** — the webhook writes with the service role, which bypasses RLS; the owner-read policy already exists.
- Adding (not renaming) columns means no data-migration risk.

## Client integration

The entire SDK surface is wrapped in one module so the rest of the app never imports RevenueCat directly.

| File | Responsibility |
|---|---|
| `lib/purchases.ts` | Thin SDK wrapper: `configurePurchases()`, `loginPurchases(userId)`, `logoutPurchases()`, `restorePurchases()`, `showManageSubscriptions()`, `presentProPaywall()`. Holds the public key (from config, **not hardcoded**) + `PRO_ENTITLEMENT = "pro"`. |
| `lib/rcEntitlement.ts` | **Pure** `isProFromCustomerInfo(info) → boolean` (checks `entitlements.active["pro"]`). |
| `lib/rcEntitlement.test.ts` | `node:test`: active / expired / missing entitlement. |
| `hooks/useEntitlement.ts` | **Refactor** to derive `isPro` from RevenueCat `CustomerInfo` via `addCustomerInfoUpdateListener` (instant, offline-cached). **Signature stays `useEntitlement(session) → {isPro}`, so `App.tsx` is unchanged.** |
| `lib/auth.tsx` / app init | `configurePurchases()` once at startup; `loginPurchases(session.user.id)` on sign-in; `logoutPurchases()` on sign-out. |
| `components/chart/ChartControls.tsx` | Lock triggers (Pro modes, Glyphs) call `presentProPaywall()` instead of opening the teaser. |
| `components/auth/AccountView.tsx` | Add **Restore purchases** + **Manage subscription** (Play requirement); show **Upgrade to Pro** when Free. |
| `components/ProLockSheet.tsx` | Retired as the buy UI (replaced by the RevenueCat paywall); kept only as a graceful fallback if offerings fail to load. |

**Init & identity:**
```
app start ─▶ configurePurchases()              // Purchases.configure({ apiKey: ANDROID_KEY })
sign-in   ─▶ loginPurchases(session.user.id)   // RC App User ID === Supabase user id
sign-out  ─▶ logoutPurchases()
```

**Entitlement signal:** `useEntitlement` subscribes to `CustomerInfo` updates → `isPro = isProFromCustomerInfo(info)`. RevenueCat caches `CustomerInfo` locally, so the gate is instant and works offline. This **changes the mobile read path** from Supabase → the RC SDK; Supabase still receives all the data via the webhook and remains the web app's gate.

**Buy flow:** tapping a locked feature → `RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier: "pro" })`. On success the `CustomerInfo` listener flips `isPro` automatically — instant unlock, no manual refresh. Cancel closes with no change.

**Restore & Manage:** `AccountView` gets a "Restore purchases" button (re-links a prior purchase after reinstall / new device — required by Play) and "Manage subscription" (deep-links to Play to cancel/change), both via `lib/purchases.ts`.

Anonymous users never see the paywall (they must sign in to reach any locked feature), so `loginPurchases` always runs before any purchase.

## Server (RevenueCat webhook → Supabase)

| File | Responsibility |
|---|---|
| `supabase/functions/revenuecat-webhook/index.ts` | Deno handler: verify auth header → parse event → call the pure mapper → upsert with the service role → return 200. |
| `supabase/functions/_shared/rcEventToRow.ts` | **Pure** `rcEventToRow(event) → { user_id, status, current_period_end, product_id, provider }`. No Deno imports → unit-testable with `node --test`. |
| `supabase/functions/_shared/rcEventToRow.test.ts` | `node:test` cases for each event type. |

**Auth:** RevenueCat sends a configurable `Authorization` header; the function compares it to `REVENUECAT_WEBHOOK_SECRET` and returns **401** on mismatch. Writes use `SUPABASE_SERVICE_ROLE_KEY` (auto-injected into Edge Functions), bypassing RLS.

**Status mapping — one pure rule (not a big type switch):**
```
isActive = (expiration_at_ms > now) AND type ∉ {EXPIRATION, REFUND, TRANSFER-away}
status   = isActive ? (period_type ∈ {TRIAL, INTRO} ? "trialing" : "active") : "expired"
current_period_end = ISO(expiration_at_ms)
product_id = event.product_id
provider   = store==="PLAY_STORE" ? "play" : store==="APP_STORE" ? "apple" : "stripe"
user_id    = event.app_user_id   // === Supabase user id
```
Lifecycle coverage:
- `INITIAL_PURCHASE` / `RENEWAL` / `PRODUCT_CHANGE` / `UNCANCELLATION` → `active` (or `trialing` during the trial).
- `CANCELLATION` (auto-renew off, still paid through period) → stays `active` until expiry.
- `BILLING_ISSUE` during grace (expiration still future) → stays `active`.
- `EXPIRATION` / `REFUND` → `expired` → entitlement drops.

**Guards:**
- If `app_user_id` is not a valid Supabase UUID (e.g. a RevenueCat anonymous `$RCAnonymousID`), **ack 200 but do not write**.
- **Idempotency/ordering:** upsert on `user_id`, and only overwrite when the event is newer (`event_timestamp_ms` vs stored `updated_at`), so a delayed/duplicate event cannot clobber newer state.
- Always return 2xx on success; RevenueCat retries non-2xx, so transient errors self-heal.

**Deploy + wire-up:** `supabase functions deploy revenuecat-webhook`; in the RevenueCat dashboard (Integrations → Webhooks) set the function URL + the shared Authorization secret.

## Lifecycle, error handling

**Lifecycle (closes audit gaps):**
- Expiry while backgrounded: the RC SDK auto-refreshes `CustomerInfo` on foreground → the listener fires → `isPro` updates. No polling.
- **Downgrade clamp:** an effect in `App.tsx` mirroring the existing `anonymous → now` one, using a pure `clampMode(mode, isPro)` helper — if `isPro` goes false while the user is in Date/Range/Compare, snap back to **Birth**; also reset custom Glyph `vis` to default so the Pro customization does not linger.

**Error handling (fail-closed = revenue-safe):**
- `configurePurchases()` in try/catch; if RC is unreachable, `isPro` stays **false** (locked, never accidentally unlocked). Cached `CustomerInfo` keeps existing subscribers passing offline.
- Paywall: cancel → no-op; error → RevenueCat surfaces it; "already owned" → restore path.
- Restore with nothing found → friendly "No purchases found."
- Webhook: non-2xx → RevenueCat auto-retries; function logs context on failure.

## Testing

**Pure unit (`node:test`, matches the project pattern):**
- `rcEntitlement.test.ts` — `isProFromCustomerInfo`.
- `rcEventToRow.test.ts` — every lifecycle case (initial / renew / trial / cancel / expire / refund), the UUID guard, and store→provider mapping.
- `clampMode` test.

**Manual (the user runs):** Play license testers / RevenueCat Test Store — buy monthly, buy yearly, start trial, cancel, expire, refund; verify `isPro` flips **and** the `subscriptions` row updates; restore after reinstall; RevenueCat "send test webhook" → confirm the row.

Real Play purchase testing needs the app on an internal-testing track + license testers; the Test Store key allows testing the flow earlier without that.

## Setup prerequisites (runbook)

A runbook doc (`docs/setup/2026-06-03-revenuecat-play-billing.md`) will cover the human/dashboard steps:
1. **Play Console:** create app, payments/merchant profile (bank), monthly + yearly subscription products with a 3-day free trial, internal-testing track + license testers.
2. **RevenueCat:** add the Google Play app + Play service-account JSON (with Play permissions), entitlement `pro`, offering with both packages mapped to Play products, configure the paywall.
3. **Webhook:** function URL + Authorization secret.
4. **Keys/secrets:** public `goog_` key → app config (`app.json` `extra` / `EXPO_PUBLIC_…`); webhook secret + service-role key → Supabase secrets (`supabase secrets set`).

Some steps need the real Play account (the user's to do, like Apple). **All code can be built and tested against the RevenueCat Test Store key first**, so implementation is not blocked.

## Tech notes

- **Install:** `npx expo install react-native-purchases react-native-purchases-ui` (Expo resolves SDK-54-compatible versions; respects pnpm via the lockfile). Then rebuild the dev build (`expo run:android`) — native code, so a JS reload is insufficient.
- **Config plugins:** both packages ship Expo config plugins; add to `app.json` plugins as needed. They do **not** work in Expo Go (fine — the app uses dev builds).
- **Keys:** the dashboard `test_…` key is a temporary Test Store key. Production uses a `goog_…` public SDK key (safe to embed, but stored in config, not hardcoded). The **secret** API key is server-only and never ships in the app.

## Future (out of scope, enabled by this design)

- **Web (Stripe):** Stripe Checkout + Stripe webhook → same `subscriptions` table (`provider='stripe'`), reusing the Stripe-specific columns. Web app gates on Supabase.
- **Apple:** add the Apple app in RevenueCat + `appl_…` key; same SDK, same webhook, `provider='apple'`. (Blocked on the Apple Developer membership, like the existing Apple Sign-In work.)
