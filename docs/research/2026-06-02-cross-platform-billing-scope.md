# Cross-Platform Billing — Scope & Plan

**Status:** Research / pre-brainstorm scope — not yet an approved spec
**Date:** 2026-06-02
**Author:** delegated research task (read by the user + the future billing brainstorm)
**Scope:** Add paid subscriptions to the MoveStar mobile app (Expo / Android-first) and unify
entitlement across web (Stripe) and mobile, keyed to one Supabase user.

> All version numbers, prices, and policy claims below were verified via web research on
> 2026-06-02. Anything I could not pin down precisely is flagged **(verify)**. Policy in this
> space is moving fast (Epic v. Google fallout) — re-check the dated claims in §3 before building.

---

## 1. Goal & constraints

**Goal.** A user can buy MoveStar Pro on *any* surface (web today via Stripe; Android next via
Google Play; iOS later) and the Pro entitlement works on *every* surface they sign in to. One
account, one entitlement, N payment sources.

**Hard constraints**
- **Account-scoped, not store-scoped entitlement** (project memory `cross-platform-account-sync`).
  Store receipts (Play / App Store / Stripe) must be validated server-side into **one** entitlement
  row keyed to the Supabase `auth.users` id.
- **Android / Google Play first.** iOS is a later consideration but the model must be store-agnostic
  from day one.
- **Reuse the existing Supabase project** as the single identity + entitlement source. The
  in-progress mobile auth slice already gives mobile Supabase sign-in + a subscription-status READ,
  so by the time billing lands the client can already read an entitlement.
- **Do not regress web.** The Stripe Checkout + Portal + webhook flow keeps working unchanged; it
  becomes one of several sources feeding the unified entitlement.
- **Soft client gate is acceptable** (matches `apps/web/lib/subscription.ts` note): the ephemeris
  runs client-side, so gating is UX, not DRM. Server-side entitlement is the source of truth for
  *billing*, not for locking the math.

---

## 2. Current state (verified in repo)

**Monorepo** (pnpm workspaces): `apps/web` (Next.js 14 App Router), `apps/mobile`
(Expo SDK ~54 / React Native 0.81 / React 19, runs in Expo Go today), `packages/engine` (shared TS).

**Backend:** Supabase (Postgres + Auth + RLS). Schema in `supabase/schema.sql` and
`supabase/migrations/20260531000000_init.sql`.

**`subscriptions` table today** (`supabase/schema.sql:29-37`) — one row per user, a thin mirror of Stripe:

| column | notes |
|---|---|
| `user_id` | PK, FK `auth.users on delete cascade` |
| `stripe_customer_id`, `stripe_subscription_id` | Stripe-specific |
| `status` | `active \| trialing \| past_due \| canceled \| incomplete` |
| `price_id` | Stripe price id |
| `current_period_end` | timestamptz |
| `updated_at` | timestamptz |

**RLS** (`schema.sql:53-54`): owner may `SELECT`; **only the service role writes** (the Stripe
webhook, via `createServiceClient()`). There is intentionally no owner INSERT/UPDATE/DELETE policy.

**Web payments today**
- `apps/web/app/api/stripe/checkout/route.ts` — creates a Checkout Session (`mode: "subscription"`),
  stamps `metadata.user_id` and `subscription_data.metadata.user_id` so the webhook can map the
  Stripe sub back to the Supabase user; reuses `stripe_customer_id` if present.
- `apps/web/app/api/stripe/portal/route.ts` — opens the Stripe Customer Portal for manage/cancel.
- `apps/web/app/api/stripe/webhook/route.ts` — verifies the signature, then on
  `checkout.session.completed` and `customer.subscription.{created,updated,deleted}` upserts the
  `subscriptions` row keyed on `metadata.user_id` (service role, bypasses RLS).
- `apps/web/lib/stripe.ts` — Stripe SDK pinned to **apiVersion `2024-06-20`**; `PRICES.monthly` /
  `PRICES.annual` come from `NEXT_PUBLIC_STRIPE_PRICE_*` env.

**Entitlement derivation today** (`apps/web/lib/subscription.ts`): `isSubscribed()` returns true iff
`status ∈ {active, trialing}`. `entitlements()` maps that to feature flags (`livingViews`,
`transits`, `themes` are paid; `natalChart` + `shareImage` are always free). **This is the contract
the unified model must preserve** — both web and mobile should derive entitlement the same way.

**Mobile today** (`apps/mobile`): Expo Go, no native modules, no IAP. `app.json` Android package is
`com.movestar.app`. No `eas.json` / EAS Build config present yet → billing will be the first thing
that forces a **custom dev/config-plugin build** (see §3).

---

## 3. Platform / policy constraints

### 3.1 The Play Billing rule (the part that matters for us)
Google Play **requires Google Play's billing system for in-app purchases of digital goods** sold to
users *within an Android app* (Play Payments policy). MoveStar Pro is a digital subscription, so
**selling Pro inside the Android app must go through Play Billing** (outside the carve-outs below).

**What is allowed cross-platform (our core design):** a subscription **bought on the web via Stripe**
that **unlocks the Android app via a server-side entitlement READ** is fine. Google's own guidance
treats cross-platform entitlements as a backend concern and explicitly supports the "buy on web,
honor in app" pattern, provided you are **not** showing a purchase/checkout UI for digital goods
inside the Android app that bypasses Play Billing. So: **READ a web-purchased entitlement = allowed;
SELL inside the Android app = Play Billing.**

### 3.2 Recent (2024–2026) policy / legal shifts — **flagged, fast-moving (verify)**
From the *Epic v. Google* injunction fallout:
- **2025-07-31** — Google lost its appeal; the 2024 injunction forcing Play Store changes was upheld.
- **2025-10-29** — Google updated US Play policies to **allow alternative / external payments** (third-party
  payment systems and external purchase links) — initially announced "no fees or restrictions."
- **Fees pending:** Google has stated it *intends to apply* reduced fees for these paths
  (reported as ~**25%** for alternative in-app billing and ~**20%** for external linking) pending a
  settlement hearing reported around **2026-01-22**, with a developer enrollment deadline reported
  near **2026-01-28**. These numbers and dates come from secondary coverage — **(verify against
  Play Console Help before relying on them).**
- **Geography:** these alternative-billing changes are **US-only** as currently described. Outside the
  US, assume **Play Billing remains mandatory** for in-app digital-goods sales.

**Implication for us:** Do **not** architect around US-only external billing. Build the Android
purchase path on **Play Billing** (works everywhere, lowest policy risk). The web→entitlement read
already gives users a fee-free path (buy on movestar's website), which is the compliant way to steer
price-sensitive users without depending on the still-settling external-billing rules.

### 3.3 Expo / EAS implications
- **Expo Go cannot run IAP** — Play Billing / StoreKit are native modules. Billing requires a
  **custom dev client + EAS Build** (config plugin). This is a real step change for `apps/mobile`,
  which has no `eas.json` today. (RevenueCat's `react-native-purchases` ships a "Preview API Mode"
  that mocks calls inside Expo Go so the JS still runs, but **real purchases require a dev build**.)
- Adds an **EAS Build pipeline + signing** task to whichever slice introduces purchasing.

### 3.4 Client SDK landscape (verified 2026-06-02)
| Option | Status | What it gives |
|---|---|---|
| **`react-native-purchases`** (RevenueCat) | Active, Expo-supported (config plugin + dev build; Preview Mode in Expo Go). Optional `react-native-purchases-ui` for prebuilt paywalls. | Unified JS API over Play Billing + StoreKit + RevenueCat Web Billing; **managed server-side receipt validation, cross-store entitlements, webhooks, analytics.** |
| **`expo-iap`** (the maintained successor to `react-native-iap`; Expo Module) | Active; listed in Expo's IAP guide alongside RevenueCat. | Direct client access to Play Billing / StoreKit via hooks. **You build all server validation + entitlement + webhooks yourself.** |
| **`expo-in-app-purchases`** | **Deprecated** (dev paused 2022-06, deprecated 2023-08, removed from Expo's recommended list; last npm release years ago). | — Do not use. |

---

## 4. Options analysis

Three ways to add the Android purchase path + unify entitlement.

### Option A — RevenueCat-centric (managed)
`react-native-purchases` on mobile → RevenueCat validates Play receipts and owns cross-store
entitlements → **RevenueCat webhook → Supabase Edge Function → entitlement row**. Stripe stays as-is
on web *or* (optionally, later) also gets fronted by RevenueCat Web Billing for a single source.

### Option B — Direct Play Billing + Stripe + custom server (roll-your-own)
`expo-iap` on mobile → backend calls **Google Play Developer API `purchases.subscriptionsv2.get`** to
validate the purchase token → **RTDN via Cloud Pub/Sub** drives renewals/cancels/refunds → write
entitlement. Stripe webhook keeps writing the same entitlement. You own all of it.

### Option C — Hybrid
Direct Play Billing + custom server for **Android** (Option B mechanics), but **keep Stripe untouched**
on web and write both into one entitlement table. No RevenueCat. (This is really "Option B done
incrementally" and is the natural fallback if RevenueCat's % fee is unattractive at scale.)

### Tradeoff table

| Dimension | A — RevenueCat | B — Direct Play API + custom | C — Hybrid (B, phased) |
|---|---|---|---|
| **Eng effort (initial)** | **Low** — SDK + one webhook → Supabase | High — Play Dev API client, Pub/Sub RTDN consumer, token validation, dedupe, retries | High (same as B) |
| **Ongoing server work** | **Minimal** (RevenueCat hosts validation/RTDN) | Significant (own the GCP Pub/Sub topic, service account, RTDN handler, Apple ASSN v2 later) | Significant |
| **Cross-store unification** | **Built-in** (RevenueCat entitlements span Play/App Store/Stripe-via-WebBilling) | DIY (you reconcile sources into one row) | DIY |
| **Ongoing cost** | Free ≤ **$2,500 MTR**, then **1%** of tracked revenue (Pro plan) | Just GCP Pub/Sub (effectively ~free at our volume) + Stripe's normal fees | Same as B |
| **Vendor lock-in** | Medium — entitlement logic lives in RevenueCat; migrating off later is work | **None** beyond the stores themselves | None |
| **Apple later** | **Trivial** (flip on App Store in dashboard) | More work (App Store Server Notifications v2 + StoreKit validation) | More work |
| **Policy risk** | Low (RevenueCat tracks store rules) | You track Play/Apple policy yourself | You track it yourself |
| **Web reuse** | Stripe stays; optional later consolidation under RevenueCat | **Stripe 100% untouched** | Stripe untouched |

### Recommendation — **Option A (RevenueCat-centric), with a clean escape hatch**

Reasoning:
1. **We are pre-revenue and Android-first.** RevenueCat is **$0 until $2,500 MTR**; at launch scale the
   1%-over-threshold fee is negligible against the weeks of backend work (Pub/Sub RTDN consumer,
   purchase-token validation, dedupe, Apple ASSN v2 later) that Option B/C demand.
2. **It directly satisfies the hard constraint.** RevenueCat's product *is* "one cross-store
   entitlement keyed to your user id" — exactly the account-scoped requirement. We map RevenueCat's
   `app_user_id` to the **Supabase user id** and let its webhook write our entitlement row.
3. **iOS later becomes a config toggle**, not another backend project.
4. **Lock-in is bounded by design:** we still own the **entitlement table in Supabase** and both
   clients read *that*, not RevenueCat. RevenueCat is a *source* writing into our model (just like the
   Stripe webhook). If the % fee ever stops making sense, we swap the source for Option B mechanics
   **without touching the read path** (web/mobile keep reading `entitlements`). That makes the
   recommendation low-regret.
5. **Stripe stays as-is for now** (Phase 3 decides whether to consolidate web under RevenueCat Web
   Billing or keep the Stripe webhook as an independent source — both feed the same table).

Pick **B/C only if** projected MTR makes 1% material *and* we have backend appetite — defer that call;
the entitlement abstraction (below) means we don't have to decide now.

---

## 5. Recommended architecture

One server-side **entitlement** per Supabase user, written by N sources, read by both clients via RLS.

```
                    ┌──────────────────────── PURCHASE SOURCES ────────────────────────┐
                    │                                                                   │
  ANDROID app  ──►  Google Play Billing  ─►  RevenueCat (validates Play receipt,        │
  (react-native-     (native, via dev build)   owns cross-store entitlement)            │
   purchases)                                        │                                  │
                                                     │ RevenueCat webhook               │
                                                     ▼                                  │
  WEB app      ──►  Stripe Checkout  ─►  Stripe webhook ──────────┐                     │
  (existing)         + Customer Portal                            │                     │
                                                                  ▼                     ▼
                                              ┌─────────────────────────────────────────────┐
                                              │ Supabase Edge Function(s) (service role)     │
                                              │  • verify signature (RC / Stripe)            │
                                              │  • map source id → Supabase user_id          │
                                              │  • upsert into `entitlements` (idempotent)   │
                                              └───────────────────────┬─────────────────────┘
                                                                      ▼
                                              ┌─────────────────────────────────────────────┐
                                              │ Supabase Postgres                            │
                                              │  entitlements (source, status, expires_at…)  │
                                              │  is_pro(user) — derived (view or fn)         │
                                              │  RLS: owner SELECT; service-role-only WRITE  │
                                              └───────────────────────┬─────────────────────┘
                                                        owner SELECT   │   owner SELECT
                                       ┌─────────────────────────────┐ │ ┌──────────────────────────┐
                                       │ WEB reads is_pro             │◄┘ │ MOBILE reads is_pro       │
                                       │ (entitlements() flags)       │   │ (same derivation)         │
                                       └──────────────────────────────┘   └──────────────────────────┘
```

Key properties:
- **Writes are service-role only** (unchanged RLS philosophy from today's `subscriptions`). Clients
  never write entitlement.
- **Reads are identical on both platforms** and derive from one `is_pro` rule — preserving the
  `apps/web/lib/subscription.ts` contract.
- **Sources are pluggable:** RevenueCat webhook and Stripe webhook are siblings. Swapping RevenueCat
  for a direct Play-Dev-API + Pub/Sub RTDN consumer (Option B) changes only the *writer*, not the
  table or the readers.
- If we keep Stripe independent (not under RevenueCat), Stripe is its own `source='stripe'` row;
  if we later move web under RevenueCat Web Billing, web collapses into `source='revenuecat'`.

---

## 6. Data-model delta

Evolve the single-source `subscriptions` table into a multi-source **`entitlements`** model plus a
derived `is_pro`. Keep `subscriptions` (or rename/repoint) so the **existing Stripe webhook keeps
working during migration** — the safest path is: add `entitlements`, **backfill from
`subscriptions`**, point readers at a derived view, then later let Stripe write `entitlements`
directly.

### Migration sketch (illustrative — NOT to apply; for the brainstorm to refine)

```sql
-- supabase/migrations/<ts>_entitlements.sql  (SKETCH)

-- One row per (user, source). A user can have a Stripe row AND a Play row simultaneously.
create table if not exists public.entitlements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  source        text not null check (source in ('stripe','play','apple','revenuecat')),
  product       text,                 -- our internal product key, e.g. 'pro_monthly'
  status        text not null,        -- normalized: active|trialing|in_grace|on_hold|canceled|expired
  store_txn_id  text,                 -- stripe_subscription_id | Play purchaseToken | Apple originalTransactionId | RC entitlement id
  expires_at    timestamptz,          -- period end / expiry (drives is_pro time check)
  auto_renew    boolean,
  raw           jsonb,                -- last validated payload from the source (audit/debug)
  updated_at    timestamptz not null default now(),
  unique (source, store_txn_id)       -- idempotent upserts per store transaction
);
create index if not exists entitlements_user_idx on public.entitlements (user_id);

alter table public.entitlements enable row level security;
-- owner may READ; only the service role (webhooks/edge fns) writes — mirrors subscriptions policy.
create policy "ent_self_select" on public.entitlements for select using (auth.uid() = user_id);
-- (no insert/update/delete policy => writes only via service role)

-- Derived "is this user Pro right now?" — single source of truth for BOTH clients.
create or replace view public.user_pro as
select u.id as user_id,
       exists (
         select 1 from public.entitlements e
         where e.user_id = u.id
           and e.status in ('active','trialing','in_grace')   -- grace still = Pro
           and (e.expires_at is null or e.expires_at > now())
       ) as is_pro
from auth.users u;
-- (RLS note: expose via a security-definer fn or a view filtered to auth.uid() so users see only their own.)

-- Status normalization map (documented, applied in the edge fn, not SQL):
--   Stripe active|trialing            -> active|trialing
--   Stripe past_due                   -> in_grace (grace) ... or on_hold per policy
--   Play  RTDN RECOVERED/RENEWED      -> active
--   Play  RTDN IN_GRACE_PERIOD        -> in_grace
--   Play  RTDN ON_HOLD/PAUSED         -> on_hold (NOT pro)
--   Play  RTDN CANCELED/EXPIRED/REVOKED -> canceled/expired (REVOKED = refund => immediate loss)
```

Relation to existing `subscriptions`:
- **Phase 1**: create `entitlements`, backfill one `source='stripe'` row per existing
  `subscriptions` row, repoint readers at `user_pro` (or an `is_pro` fn). `subscriptions` stays
  as the Stripe webhook's write target during transition.
- **Phase 3**: either (a) make the Stripe webhook write `entitlements` directly and retire
  `subscriptions`, or (b) keep `subscriptions` as Stripe's table and treat it as just another source
  view-merged into `user_pro`. Decide in the brainstorm.
- The web `entitlements()` feature-flag function (`apps/web/lib/subscription.ts`) is unchanged — it
  just consumes `is_pro` instead of raw Stripe `status`. **Promote it into `packages/engine`** so web
  and mobile share one derivation. (Pending: confirm whether `packages/engine` should own this — it
  currently holds astro math, not billing.)

---

## 7. Phased plan (each phase = a candidate future slice)

> Sequenced so value lands early and risk is isolated. P1 ships *no purchasing* — it just makes the
> data model store-agnostic and gives mobile a real Pro read.

**P1 — Unified entitlement model + read (no new purchasing).**
- Add `entitlements` table + `user_pro` derivation (migration in §6); backfill from `subscriptions`.
- Move entitlement derivation into shared code (`packages/engine` or a shared lib) so web + mobile
  agree on `is_pro`.
- Web: read `is_pro` from the new model (behavior-identical).
- Mobile: the in-progress auth slice's "subscription-status READ" reads `user_pro`.
- *Outcome:* a web/Stripe Pro user installing Android and signing in is **already Pro on mobile** —
  the headline cross-platform win, with **zero** store-billing code.

**P2 — Android purchasing via Play Billing + RevenueCat validation.**
- Stand up **EAS Build + a custom dev client** (first native build for `apps/mobile`); add the
  `react-native-purchases` config plugin.
- Create RevenueCat project; configure Android products/entitlement; set `app_user_id = Supabase user id`.
- Build the paywall + purchase + **restore purchases** flow on mobile.
- **RevenueCat webhook → Supabase Edge Function** writes `source='play'`/`'revenuecat'` rows into
  `entitlements` (idempotent on `store_txn_id`).
- *Outcome:* users can buy Pro on Android; it flows into the same entitlement web already reads.

**P3 — Unify / reconcile with Stripe.**
- Decide: keep Stripe as an independent `source='stripe'` writer, **or** consolidate web under
  RevenueCat Web Billing for a single dashboard. Either way both feed `entitlements`.
- Handle the **dual-source case** (same person subscribed on web *and* Android): `user_pro` already
  OR-s sources, but add product/billing UX so we don't actively sell a 2nd sub to an already-Pro user
  (show "managed on the web/Play" instead of a buy button when an active entitlement exists).
- Reconciliation + refunds/expiry parity across sources.

**P4 — Apple / App Store (when iOS ships).**
- Flip on App Store in RevenueCat (StoreKit). If we went Option B, this is where **App Store Server
  Notifications v2** + StoreKit validation get built. `source='apple'` rows; no read-path change.

**Cross-cutting (lands with P2):** RTDN/refund handling — refund/chargeback (Play `REVOKED`) →
immediate entitlement loss; expiry; **grace period** (still Pro) vs **account hold** (not Pro);
RevenueCat surfaces these as webhook events so P2 covers most of it.

---

## 8. Open questions / decisions needed from the user

1. **RevenueCat vs roll-your-own** — accept the recommendation (Option A, escape hatch preserved)?
   The only real cost is **1% of tracked revenue above $2,500/mo**. OK at launch scale?
2. **Pricing parity** — should Play (and later Apple) mirror the **exact** Stripe monthly/annual price
   points, or price higher on stores to offset the 15–30% store cut? (Affects §6 `product` mapping.)
3. **Stripe consolidation (P3)** — keep Stripe as an independent source forever, or eventually move
   web billing under RevenueCat Web Billing for one dashboard?
4. **Schema disposition** — retire `subscriptions` after backfill, or keep it as Stripe's table and
   merge via view? (See §6 Phase 3.)
5. **Where does `is_pro` derivation live** — promote `apps/web/lib/subscription.ts` logic into
   `packages/engine`, or a new shared `packages/entitlements`?
6. **Dual-subscription policy** — if someone is already Pro via web, do we hide the Android buy button
   entirely, or allow it (and risk double-billing)? (Recommend: hide + show "manage on web".)
7. **Free trial parity** — does mobile offer the same trial as web? Trials interact with Play
   vs Stripe trial semantics.
8. **US external-billing path (§3.2)** — ignore for now (recommend), or revisit once the
   Jan-2026 settlement/fees are final, to steer users to the fee-free web purchase?

---

## 9. External setup the user must do (no code — accounts/infra)

- **Google Play Console**: developer account; create the app (package `com.movestar.app`); define the
  **subscription products** + base plans; complete the payments profile.
- **RevenueCat account** (if Option A): create project; add the Play app; upload the **Play service
  account JSON** so RC can validate; define **entitlement** ("pro") + offerings; set the **webhook**
  to the Supabase Edge Function URL; configure `app_user_id` = Supabase user id.
- **Google Cloud / Pub/Sub** *(only if Option B/C, or for RC's RTDN passthrough)*: GCP project; a
  **Pub/Sub topic**; grant `google-play-developer-notifications@system.gserviceaccount.com` the
  **Pub/Sub Publisher** role; wire the topic to Play Console → Monetization → RTDN.
- **Google Play Developer API**: enable the Android Publisher API; create a **service account** with
  Play Console access for purchase-token validation (`purchases.subscriptionsv2.get`).
- **Expo / EAS**: an Expo account + **EAS Build** set up for `apps/mobile`; **Android upload/signing
  keys**; an internal-testing track in Play for QA of real purchases (Play Billing needs a signed,
  uploaded build — not Expo Go).
- **Supabase**: deploy the Edge Function(s) for the RevenueCat (and/or Stripe) webhooks; store the
  service-role key + webhook secrets as function secrets.
- **Apple** *(P4 only)*: Apple Developer Program; App Store Connect app + subscription products;
  App Store Server API key + **App Store Server Notifications v2** endpoint (or just enable in RC).

---

## 10. References (verified 2026-06-02)

- [RevenueCat `react-native-purchases` (GitHub)](https://github.com/RevenueCat/react-native-purchases) — the active RN/Expo IAP SDK; Play Billing + StoreKit + Web Billing wrapper.
- [RevenueCat — Expo install guide](https://www.revenuecat.com/docs/getting-started/installation/expo) — config plugin + dev build; Preview API Mode mocks Expo Go.
- [Expo — Using in-app purchases](https://docs.expo.dev/guides/in-app-purchases/) — lists only `react-native-purchases` and `expo-iap`; confirms native build requirement.
- [Adapty — Expo IAP tutorial (2026)](https://adapty.io/blog/expo-in-app-purchases-tutorial/) — corroborates `expo-in-app-purchases` deprecation + current options.
- [RevenueCat — Pricing](https://www.revenuecat.com/pricing) — **Free ≤ $2,500 MTR, then 1% of tracked revenue** (Pro); Enterprise custom.
- [Google Play — Understanding Play's Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818) — the digital-goods / Play Billing requirement (authoritative; re-check §3.2 dates here).
- [Android Developers — Google Play's billing system](https://developer.android.com/google/play/billing) — backend integration + cross-platform entitlement guidance.
- [Android Developers — Purchase lifecycle & RTDNs](https://developer.android.com/google/play/billing/lifecycle) and [RTDN reference](https://developer.android.com/google/play/billing/rtdn-reference) — Pub/Sub setup, message dedupe via `messageId`.
- [Google Play Developer API — `purchases.subscriptionsv2`](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2) — server-side purchase-token validation (source of truth); token valid until 60 days post-expiry.
- [RevenueCat — Webhooks](https://www.revenuecat.com/docs/integrations/webhooks) — event payloads → backend; respond 200 to stop retries.
- [RevenueCat + Supabase reference impl (Flutter, GitHub)](https://github.com/camilopenalver/flutter-revenuecat-supabase) — pattern: RC webhook → Supabase Edge Function → entitlement row + RLS.
- [RevenueCat — App-to-web external purchase guidelines](https://www.revenuecat.com/blog/engineering/app-to-web-purchase-guidelines/) — current iOS/Android external-purchase nuances.
- [Neon Commerce — Google Play's new US billing/linking policies (Dec 2025)](https://www.neonpay.com/blog/google-plays-new-u.s.-billing-linking-policies-what-game-developers-need-to-know) — Epic v. Google timeline; **secondary source — verify fee %/dates against Play Console Help.**
