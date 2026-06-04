# Google Play Billing (RevenueCat) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in Free user buy the monthly or yearly Pro subscription through Google Play via RevenueCat, with `isPro` flipping instantly in-app and every change mirrored into the Supabase `public.subscriptions` table.

**Architecture:** RevenueCat is the source of truth. The app wraps the SDK in `lib/purchases.ts`, links the RevenueCat App User ID to the Supabase user id (`logIn`), reads entitlement from `CustomerInfo` (instant/offline), and shows the prebuilt RevenueCat paywall on locked features. A RevenueCat webhook → Supabase Edge Function mirrors entitlement into `subscriptions` (service role). Pure logic (entitlement check, mode clamp, webhook→row mapping) is split into import-free modules tested under `node --test`.

**Tech Stack:** Expo SDK 54 / React Native 0.81 / React 19 / TypeScript; `react-native-purchases` + `react-native-purchases-ui`; Supabase (Postgres + Edge Functions/Deno). Tests: `node --test --experimental-strip-types` (pure TS only — no RN/supabase/Deno imports in tested files).

**Spec:** `docs/specs/2026-06-03-google-play-billing-design.md`.

**Branch:** `feat/mobile-accounts-entitlement` (local commits + push; not main). On-device purchase QA is the user's to run (Task 14).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260603120000_subscriptions_provider_agnostic.sql` | Add `provider` + `product_id` columns; backfill existing rows as `stripe` |
| `supabase/schema.sql` | Keep the canonical schema doc in sync with the migration |
| `apps/mobile/lib/rcEntitlement.ts` (+ `.test.ts`) | **pure** `PRO_ENTITLEMENT`, `isProFromCustomerInfo` — no SDK import (TDD) |
| `apps/mobile/lib/proMode.ts` (+ `.test.ts`) | **pure** `PRO_MODES`, `clampMode` — shared by `App.tsx` + `ChartControls` (TDD) |
| `supabase/functions/_shared/rcEventToRow.ts` (+ `.test.ts`) | **pure** `rcEventToRow` webhook→row mapper — no Deno import (TDD) |
| `supabase/functions/revenuecat-webhook/index.ts` | Deno handler: auth → parse → map → upsert (service role) |
| `apps/mobile/lib/purchases.ts` | Thin RevenueCat SDK wrapper (configure/login/logout/restore/manage/paywall) |
| `apps/mobile/lib/auth.tsx` | Call configure once; login/logout on session change |
| `apps/mobile/hooks/useEntitlement.ts` | Refactor: derive `isPro` from `CustomerInfo` (signature unchanged) |
| `apps/mobile/components/chart/ChartControls.tsx` | Locked Pro modes/Glyphs → present RevenueCat paywall |
| `apps/mobile/App.tsx` | Downgrade clamp + reset Glyph `vis` when `isPro` drops |
| `apps/mobile/components/auth/AccountView.tsx` | Restore purchases / Manage subscription / Upgrade to Pro |
| `apps/mobile/app.json` | RevenueCat config plugin + public key in `extra` |
| `docs/setup/2026-06-03-revenuecat-play-billing.md` | Human/dashboard runbook (Play Console, RevenueCat, webhook, secrets) |

**Out of scope:** Apple IAP, web Stripe (schema-ready, not built).

**Test commands used throughout:**
- Mobile pure tests: `pnpm --filter @astro/mobile test`
- Shared function pure tests: `node --test --experimental-strip-types "supabase/functions/_shared/*.test.ts"` (run from repo root)
- Mobile typecheck: `pnpm --filter @astro/mobile typecheck`

---

## Task 1: Provider-agnostic `subscriptions` migration

Adds columns only — no rename, no data-migration risk. The read path (`status`, `current_period_end`) is untouched.

**Files:**
- Create: `supabase/migrations/20260603120000_subscriptions_provider_agnostic.sql`
- Modify: `supabase/schema.sql` (subscriptions block, keep doc in sync)

- [ ] **Step 1: Write the migration** — `supabase/migrations/20260603120000_subscriptions_provider_agnostic.sql`:
```sql
-- Make public.subscriptions provider-agnostic so Play (now), Stripe (web), and Apple
-- can all write to one table. Read path (status, current_period_end) is unchanged.
alter table public.subscriptions
  add column if not exists provider   text,   -- 'play' | 'stripe' | 'apple'
  add column if not exists product_id text;   -- generic product purchased (RC product id)

-- Backfill any existing rows as the provider they came from.
update public.subscriptions
  set provider = 'stripe'
  where provider is null and stripe_subscription_id is not null;
```

- [ ] **Step 2: Mirror the change in `supabase/schema.sql`** — update the subscriptions `create table` block to include the two new columns so the canonical schema doc matches. Find the block (starts at the line `create table if not exists public.subscriptions (`) and add the two columns before `updated_at`:
```sql
  status text,
  price_id text,
  provider text,        -- 'play' | 'stripe' | 'apple'
  product_id text,      -- generic product purchased (RC product id)
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
```

- [ ] **Step 3: Verify the SQL is well-formed** (no DB connection required here)

Run: `grep -n "provider\|product_id" supabase/migrations/20260603120000_subscriptions_provider_agnostic.sql`
Expected: shows the `add column` lines and the backfill `provider` line.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260603120000_subscriptions_provider_agnostic.sql supabase/schema.sql
git commit -m "feat(db): provider-agnostic subscriptions (provider, product_id)"
```

> Note: applying the migration to the live Supabase project (`supabase db push` or dashboard) is part of the runbook (Task 13) / the user's deploy step — not this code task.

---

## Task 2: Pure RC entitlement check (TDD)

Pure module — **no `react-native-purchases` import** so it loads under `node --test`. It accepts a structural subset of `CustomerInfo`.

**Files:**
- Create: `apps/mobile/lib/rcEntitlement.ts`
- Test: `apps/mobile/lib/rcEntitlement.test.ts`

- [ ] **Step 1: Write the failing test** — `apps/mobile/lib/rcEntitlement.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isProFromCustomerInfo, PRO_ENTITLEMENT } from "./rcEntitlement.ts";

test("PRO_ENTITLEMENT is 'pro'", () => {
  assert.equal(PRO_ENTITLEMENT, "pro");
});

test("null/undefined customer info → not Pro", () => {
  assert.equal(isProFromCustomerInfo(null), false);
  assert.equal(isProFromCustomerInfo(undefined), false);
});

test("active 'pro' entitlement → Pro", () => {
  const info = { entitlements: { active: { pro: { identifier: "pro" } } } };
  assert.equal(isProFromCustomerInfo(info), true);
});

test("no active entitlements → not Pro", () => {
  assert.equal(isProFromCustomerInfo({ entitlements: { active: {} } }), false);
});

test("a different active entitlement → not Pro", () => {
  const info = { entitlements: { active: { plus: { identifier: "plus" } } } };
  assert.equal(isProFromCustomerInfo(info), false);
});

test("malformed shape → not Pro (never throws)", () => {
  assert.equal(isProFromCustomerInfo({}), false);
  assert.equal(isProFromCustomerInfo({ entitlements: {} }), false);
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `pnpm --filter @astro/mobile test`
Expected: FAIL — `Cannot find module './rcEntitlement.ts'`.

- [ ] **Step 3: Implement `apps/mobile/lib/rcEntitlement.ts`**
```ts
// Pure entitlement check over RevenueCat CustomerInfo. No SDK import so it runs under
// `node --test`. Accepts a structural subset of CustomerInfo (entitlements.active map).

/** The RevenueCat entitlement identifier that unlocks Pro. Must match the dashboard. */
export const PRO_ENTITLEMENT = "pro";

interface CustomerInfoLike {
  entitlements?: { active?: Record<string, unknown> | null } | null;
}

/** True iff the "pro" entitlement is currently active. Defensive against null/malformed input. */
export function isProFromCustomerInfo(info: CustomerInfoLike | null | undefined): boolean {
  const active = info?.entitlements?.active;
  if (!active || typeof active !== "object") return false;
  return PRO_ENTITLEMENT in active;
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS (all rcEntitlement cases green).

- [ ] **Step 5: Commit**
```bash
git add apps/mobile/lib/rcEntitlement.ts apps/mobile/lib/rcEntitlement.test.ts
git commit -m "feat(mobile): pure RevenueCat entitlement check (isProFromCustomerInfo)"
```

---

## Task 3: Pure mode-clamp helper (TDD)

Centralizes `PRO_MODES` (currently inline in `ChartControls.tsx`) and adds `clampMode` for the downgrade case. Pure — uses only the `Mode` type (erased), so it runs under `node --test`.

**Files:**
- Create: `apps/mobile/lib/proMode.ts`
- Test: `apps/mobile/lib/proMode.test.ts`

- [ ] **Step 1: Write the failing test** — `apps/mobile/lib/proMode.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRO_MODES, isProMode, clampMode } from "./proMode.ts";

test("PRO_MODES are exactly moment, range, compare", () => {
  assert.deepEqual([...PRO_MODES].sort(), ["compare", "moment", "range"]);
});

test("isProMode flags only the pro modes", () => {
  assert.equal(isProMode("moment"), true);
  assert.equal(isProMode("range"), true);
  assert.equal(isProMode("compare"), true);
  assert.equal(isProMode("birth"), false);
  assert.equal(isProMode("now"), false);
});

test("clampMode: Pro user keeps any mode", () => {
  assert.equal(clampMode("compare", true), "compare");
  assert.equal(clampMode("birth", true), "birth");
});

test("clampMode: non-Pro in a Pro mode snaps to birth", () => {
  assert.equal(clampMode("moment", false), "birth");
  assert.equal(clampMode("range", false), "birth");
  assert.equal(clampMode("compare", false), "birth");
});

test("clampMode: non-Pro in an allowed mode is unchanged", () => {
  assert.equal(clampMode("birth", false), "birth");
  assert.equal(clampMode("now", false), "now");
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `pnpm --filter @astro/mobile test`
Expected: FAIL — `Cannot find module './proMode.ts'`.

- [ ] **Step 3: Implement `apps/mobile/lib/proMode.ts`**
```ts
// Pure Pro-mode policy: which chart modes require Pro, and how to clamp the active mode
// when entitlement is lost. Imports only the erased Mode type, so it runs under node --test.
import type { Mode } from "./chartModel.ts";

/** Chart modes that require a Pro subscription. */
export const PRO_MODES: readonly Mode[] = ["moment", "range", "compare"];

/** True iff the mode requires Pro. */
export function isProMode(mode: Mode): boolean {
  return PRO_MODES.includes(mode);
}

/** The mode the app should display given entitlement: a non-Pro user sitting in a Pro mode
 *  (e.g. after a subscription expires) is snapped back to "birth". Otherwise unchanged. */
export function clampMode(mode: Mode, isPro: boolean): Mode {
  if (!isPro && isProMode(mode)) return "birth";
  return mode;
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/mobile/lib/proMode.ts apps/mobile/lib/proMode.test.ts
git commit -m "feat(mobile): pure PRO_MODES + clampMode helper"
```

---

## Task 4: Pure RevenueCat webhook → row mapper (TDD)

Pure module under `supabase/functions/_shared/` — **no Deno imports** so the test runs under `node --test` (Deno's `index.ts` imports it via native `.ts`).

**Files:**
- Create: `supabase/functions/_shared/rcEventToRow.ts`
- Test: `supabase/functions/_shared/rcEventToRow.test.ts`

- [ ] **Step 1: Write the failing test** — `supabase/functions/_shared/rcEventToRow.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { rcEventToRow } from "./rcEventToRow.ts";

const UUID = "11111111-1111-1111-1111-111111111111";
const future = Date.now() + 30 * 24 * 3600 * 1000;
const past = Date.now() - 24 * 3600 * 1000;

const base = {
  app_user_id: UUID,
  product_id: "pro_monthly",
  store: "PLAY_STORE",
  period_type: "NORMAL",
  expiration_at_ms: future,
  event_timestamp_ms: 1_700_000_000_000,
};

test("initial purchase (future expiry) → active/play", () => {
  const row = rcEventToRow({ ...base, type: "INITIAL_PURCHASE" });
  assert.equal(row?.user_id, UUID);
  assert.equal(row?.status, "active");
  assert.equal(row?.provider, "play");
  assert.equal(row?.product_id, "pro_monthly");
  assert.equal(row?.current_period_end, new Date(future).toISOString());
});

test("trial period → trialing", () => {
  const row = rcEventToRow({ ...base, type: "INITIAL_PURCHASE", period_type: "TRIAL" });
  assert.equal(row?.status, "trialing");
});

test("cancellation with future expiry stays active (access until period end)", () => {
  const row = rcEventToRow({ ...base, type: "CANCELLATION" });
  assert.equal(row?.status, "active");
});

test("expiration → expired", () => {
  const row = rcEventToRow({ ...base, type: "EXPIRATION", expiration_at_ms: past });
  assert.equal(row?.status, "expired");
});

test("refund → expired even if expiry still future", () => {
  const row = rcEventToRow({ ...base, type: "REFUND" });
  assert.equal(row?.status, "expired");
});

test("app store / stripe map to apple / stripe providers", () => {
  assert.equal(rcEventToRow({ ...base, type: "RENEWAL", store: "APP_STORE" })?.provider, "apple");
  assert.equal(rcEventToRow({ ...base, type: "RENEWAL", store: "STRIPE" })?.provider, "stripe");
});

test("non-UUID app_user_id (anonymous) → null (skip write)", () => {
  assert.equal(rcEventToRow({ ...base, type: "INITIAL_PURCHASE", app_user_id: "$RCAnonymousID:abc" }), null);
});

test("missing app_user_id → null", () => {
  assert.equal(rcEventToRow({ ...base, type: "INITIAL_PURCHASE", app_user_id: undefined }), null);
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `node --test --experimental-strip-types "supabase/functions/_shared/*.test.ts"`
Expected: FAIL — `Cannot find module './rcEventToRow.ts'`.

- [ ] **Step 3: Implement `supabase/functions/_shared/rcEventToRow.ts`**
```ts
// Pure mapper: a RevenueCat webhook event → a public.subscriptions upsert row.
// No Deno/supabase imports, so it unit-tests under `node --test` and imports cleanly in Deno.

export interface RcEvent {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  store?: string;                 // PLAY_STORE | APP_STORE | STRIPE | RC_BILLING | ...
  period_type?: string;           // NORMAL | TRIAL | INTRO
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
}

export interface SubscriptionRow {
  user_id: string;
  status: "active" | "trialing" | "expired";
  current_period_end: string | null;
  product_id: string | null;
  provider: "play" | "apple" | "stripe";
  updated_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITLEMENT_ENDING = new Set(["EXPIRATION", "REFUND", "TRANSFER"]);

function providerOf(store: string | undefined): SubscriptionRow["provider"] {
  if (store === "APP_STORE") return "apple";
  if (store === "STRIPE" || store === "RC_BILLING") return "stripe";
  return "play"; // PLAY_STORE and anything else default to play (we are Play-first)
}

/** Map an event to a row, or null when there is no signed-in user to attribute it to
 *  (anonymous RevenueCat id) — the caller acks 200 without writing. */
export function rcEventToRow(event: RcEvent): SubscriptionRow | null {
  const userId = event.app_user_id;
  if (!userId || !UUID_RE.test(userId)) return null;

  const expMs = typeof event.expiration_at_ms === "number" ? event.expiration_at_ms : null;
  const ending = ENTITLEMENT_ENDING.has(event.type ?? "");
  const isActive = !ending && expMs !== null && expMs > Date.now();
  const isTrial = event.period_type === "TRIAL" || event.period_type === "INTRO";

  return {
    user_id: userId,
    status: isActive ? (isTrial ? "trialing" : "active") : "expired",
    current_period_end: expMs !== null ? new Date(expMs).toISOString() : null,
    product_id: event.product_id ?? null,
    provider: providerOf(event.store),
    updated_at: new Date(event.event_timestamp_ms ?? Date.now()).toISOString(),
  };
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `node --test --experimental-strip-types "supabase/functions/_shared/*.test.ts"`
Expected: PASS (all rcEventToRow cases green).

- [ ] **Step 5: Commit**
```bash
git add supabase/functions/_shared/rcEventToRow.ts supabase/functions/_shared/rcEventToRow.test.ts
git commit -m "feat(functions): pure RevenueCat event → subscriptions row mapper"
```

---

## Task 5: RevenueCat webhook Edge Function (Deno)

Thin Deno wrapper around the pure mapper: verify the shared secret, map, upsert with the service role, with an ordering guard.

**Files:**
- Create: `supabase/functions/revenuecat-webhook/index.ts`

- [ ] **Step 1: Implement `supabase/functions/revenuecat-webhook/index.ts`**
```ts
// RevenueCat webhook → mirror entitlement into public.subscriptions (service role).
// Auth: RevenueCat sends a configured Authorization header; we compare to REVENUECAT_WEBHOOK_SECRET.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { rcEventToRow } from "../_shared/rcEventToRow.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (req.headers.get("Authorization") !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { event?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const row = rcEventToRow((body.event ?? {}) as Parameters<typeof rcEventToRow>[0]);
  // Anonymous / unattributable event: acknowledge so RevenueCat stops retrying, but write nothing.
  if (!row) return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Ordering guard: don't let a delayed/duplicate event overwrite newer state.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("updated_at")
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (existing?.updated_at && new Date(existing.updated_at) > new Date(row.updated_at)) {
    return new Response(JSON.stringify({ ok: true, stale: true }), { status: 200 });
  }

  const { error } = await supabase.from("subscriptions").upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error("subscriptions upsert failed:", error.message);
    return new Response("DB error", { status: 500 }); // non-2xx → RevenueCat retries
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```

- [ ] **Step 2: Verify it imports the pure mapper and reads the three env vars**

Run: `grep -n "rcEventToRow\|REVENUECAT_WEBHOOK_SECRET\|SERVICE_ROLE\|onConflict" supabase/functions/revenuecat-webhook/index.ts`
Expected: shows the import, the secret check, the service-role client, and the upsert `onConflict: "user_id"`.

- [ ] **Step 3: Commit**
```bash
git add supabase/functions/revenuecat-webhook/index.ts
git commit -m "feat(functions): revenuecat-webhook Edge Function (auth + upsert)"
```

> Note: `supabase functions deploy revenuecat-webhook`, `supabase secrets set REVENUECAT_WEBHOOK_SECRET=…`, and wiring the URL in the RevenueCat dashboard are runbook/deploy steps (Task 13 + the user).

---

## Task 6: Install the RevenueCat SDK + config

Adds the native packages and the public key to config. This is a build/environment task (no unit test); it ends by confirming the dev build compiles.

**Files:**
- Modify: `apps/mobile/app.json` (plugins + `extra` key)
- (package.json / lockfile updated by `expo install`)

- [ ] **Step 1: Install the packages** (resolves SDK-54-compatible versions, respects pnpm)

Run from `apps/mobile/`: `npx expo install react-native-purchases react-native-purchases-ui expo-constants`
Expected: `react-native-purchases`, `react-native-purchases-ui`, and `expo-constants` added to `apps/mobile/package.json`.

- [ ] **Step 2: Add the config plugin + public key to `apps/mobile/app.json`**

Add `"react-native-purchases"` to the `plugins` array, and add an `extra` block with the RevenueCat public key(s). Use the dashboard **Test Store** key for now (a public key; the real `goog_…` key replaces it before launch). Resulting `expo` object additions:
```json
"plugins": [
  "expo-font",
  "@react-native-community/datetimepicker",
  "expo-web-browser",
  "expo-apple-authentication",
  "react-native-purchases"
],
"extra": {
  "revenueCatAndroidKey": "test_bWUBDRvMQHIlTkZvZzFAofTJoLo",
  "revenueCatIosKey": "test_bWUBDRvMQHIlTkZvZzFAofTJoLo"
}
```

- [ ] **Step 3: Rebuild the dev build** (native code added — JS reload is insufficient)

Run from `apps/mobile/`: `npx expo run:android`
Expected: Gradle `BUILD SUCCESSFUL`; the app launches on the emulator/device with the new native module linked.

- [ ] **Step 4: Commit**
```bash
git add apps/mobile/package.json apps/mobile/app.json pnpm-lock.yaml
git commit -m "chore(mobile): add react-native-purchases (+ui) + RevenueCat config"
```

---

## Task 7: RevenueCat SDK wrapper

One module so the rest of the app never imports RevenueCat directly. Not pure (imports the SDK) → verified by typecheck, not node:test.

**Files:**
- Create: `apps/mobile/lib/purchases.ts`

- [ ] **Step 1: Implement `apps/mobile/lib/purchases.ts`**
```ts
// Thin wrapper around RevenueCat so the rest of the app never imports the SDK directly.
import { Platform, Linking } from "react-native";
import Constants from "expo-constants";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import type { CustomerInfo } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { PRO_ENTITLEMENT } from "./rcEntitlement";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  revenueCatAndroidKey?: string;
  revenueCatIosKey?: string;
};

function apiKey(): string {
  const key = Platform.OS === "ios" ? extra.revenueCatIosKey : extra.revenueCatAndroidKey;
  return key ?? "";
}

let configured = false;

/** Configure the SDK once at app start. Fail-closed: swallow errors so the app still runs
 *  (entitlement simply stays Free until the SDK is reachable). */
export function configurePurchases(): void {
  if (configured) return;
  const key = apiKey();
  if (!key) {
    console.warn("RevenueCat key missing — purchases disabled");
    return;
  }
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: key });
    configured = true;
  } catch (e) {
    console.warn("RevenueCat configure failed:", e);
  }
}

/** Link the RevenueCat App User ID to the Supabase user id (so the webhook can attribute sales). */
export async function loginPurchases(userId: string): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn("RevenueCat logIn failed:", e);
  }
}

/** Return to an anonymous RevenueCat id on sign-out. */
export async function logoutPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    // logOut throws if already anonymous — non-fatal.
    console.warn("RevenueCat logOut skipped:", e);
  }
}

/** Current CustomerInfo, or null if unavailable. */
export async function getCustomerInfoSafe(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

/** Subscribe to entitlement changes; returns an unsubscribe fn. No-op if not configured. */
export function onCustomerInfo(listener: (info: CustomerInfo) => void): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}

/** Present the prebuilt paywall if the user lacks Pro. Returns true if they now have it. */
export async function presentProPaywall(): Promise<boolean> {
  if (!configured) return false;
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT,
    });
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
  } catch (e) {
    console.warn("Paywall error:", e);
    return false;
  }
}

/** Restore prior purchases (Play requirement). Returns true if Pro is now active. */
export async function restorePurchases(): Promise<boolean> {
  if (!configured) return false;
  try {
    const info = await Purchases.restorePurchases();
    return PRO_ENTITLEMENT in (info.entitlements.active ?? {});
  } catch (e) {
    console.warn("Restore failed:", e);
    return false;
  }
}

/** Open the store's manage-subscription page (Play subscriptions screen). */
export async function showManageSubscriptions(): Promise<void> {
  const info = await getCustomerInfoSafe();
  if (info?.managementURL) {
    Linking.openURL(info.managementURL).catch((e) => console.warn("openURL failed:", e));
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**
```bash
git add apps/mobile/lib/purchases.ts
git commit -m "feat(mobile): RevenueCat SDK wrapper (configure/login/paywall/restore)"
```

---

## Task 8: Wire configure + login/logout into AuthProvider

Configure once on mount; log in/out as the session changes. This keeps the RevenueCat identity in lockstep with Supabase auth.

**Files:**
- Modify: `apps/mobile/lib/auth.tsx`

- [ ] **Step 1: Add the import** near the other imports in `apps/mobile/lib/auth.tsx`:
```ts
import { configurePurchases, loginPurchases, logoutPurchases } from "./purchases";
```

- [ ] **Step 2: Configure once + sync identity** — replace the existing session `useEffect` (currently the block starting `useEffect(() => {` that calls `supabase.auth.getSession()`) with:
```ts
  useEffect(() => {
    configurePurchases();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user?.id) loginPurchases(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) loginPurchases(s.user.id);
      else logoutPurchases();
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add apps/mobile/lib/auth.tsx
git commit -m "feat(mobile): link RevenueCat identity to Supabase auth"
```

---

## Task 9: Refactor `useEntitlement` to read RevenueCat CustomerInfo

The mobile gate now reads entitlement from the SDK (instant, offline). **Signature stays `useEntitlement(session) → { isPro }`** so `App.tsx` is unchanged. The Supabase row is still written by the webhook (durable record / web source of truth) — it just isn't the mobile read path anymore.

**Files:**
- Modify: `apps/mobile/hooks/useEntitlement.ts` (full rewrite)

- [ ] **Step 1: Rewrite `apps/mobile/hooks/useEntitlement.ts`**
```ts
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getCustomerInfoSafe, onCustomerInfo } from "../lib/purchases";
import { isProFromCustomerInfo } from "../lib/rcEntitlement";

/** isPro for the current session, sourced from RevenueCat CustomerInfo (instant, offline-cached).
 *  Free when signed out. Re-evaluates when the user changes and on every CustomerInfo update. */
export function useEntitlement(session: Session | null): { isPro: boolean } {
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    if (!session) { setIsPro(false); return; }
    setIsPro(false); // reset while the new user's entitlement loads
    let active = true;
    getCustomerInfoSafe().then((info) => { if (active) setIsPro(isProFromCustomerInfo(info)); });
    const unsubscribe = onCustomerInfo((info) => { if (active) setIsPro(isProFromCustomerInfo(info)); });
    return () => { active = false; unsubscribe(); };
  }, [session?.user?.id]);
  return { isPro };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Run pure tests (ensure nothing broke)**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS (existing + new pure tests).

- [ ] **Step 4: Commit**
```bash
git add apps/mobile/hooks/useEntitlement.ts
git commit -m "feat(mobile): source entitlement from RevenueCat CustomerInfo"
```

---

## Task 10: ChartControls — present the paywall on locked features

Replace the placeholder `ProLockSheet` open with the real RevenueCat paywall, and consume the shared `PRO_MODES`/`isProMode`.

**Files:**
- Modify: `apps/mobile/components/chart/ChartControls.tsx`

- [ ] **Step 1: Add imports** near the other imports in `apps/mobile/components/chart/ChartControls.tsx`:
```ts
import { presentProPaywall } from "../../lib/purchases";
import { isProMode } from "../../lib/proMode";
```

- [ ] **Step 2: Remove the local `PRO_MODES` + route locks to the paywall** — replace the current block inside `ChartControls` (the lines `const [proLock, setProLock] = useState(false);` through the `onModeChange` definition) with:
```ts
  const modeOptions = MODES.map((m) =>
    !isPro && isProMode(m.key) ? { key: m.key, label: `${m.label} 🔒` } : m,
  );
  const onModeChange = (m: Mode) => {
    if (!isPro && isProMode(m)) { void presentProPaywall(); return; }
    setMode(m);
  };
```

- [ ] **Step 3: Route the Glyphs lock to the paywall** — in the `Glyphs` `Section`, replace the locked `Pressable`'s `onPress={() => setProLock(true)}` with `onPress={() => void presentProPaywall()}`.

- [ ] **Step 4: Remove the now-unused `ProLockSheet`** — delete the `<ProLockSheet visible={proLock} onClose={() => setProLock(false)} />` line and the `import { ProLockSheet } from "../ProLockSheet";` import. (The component file stays in the repo as a fallback but is no longer rendered here.)

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS — no unused `proLock`/`setProLock`/`ProLockSheet`/`PRO_MODES` references remain.

- [ ] **Step 6: Commit**
```bash
git add apps/mobile/components/chart/ChartControls.tsx
git commit -m "feat(mobile): present RevenueCat paywall on locked modes + Glyphs"
```

---

## Task 11: App.tsx — downgrade clamp + reset Glyph customization

When `isPro` drops (expiry/refund), snap out of any Pro mode and reset Glyph `vis` so no Pro surface lingers. Mirrors the existing `anonymous → now` effect.

**Files:**
- Modify: `apps/mobile/App.tsx`

- [ ] **Step 1: Add the import** alongside the existing `tierOf` import in `apps/mobile/App.tsx`:
```ts
import { clampMode } from "./lib/proMode";
```
(`allVisible` and `PLANET_KEYS` are already imported.)

- [ ] **Step 2: Add the clamp effect** immediately after the existing anonymous force-Now effect (the block `useEffect(() => { if (anonymous) clock.setMode("now"); }, [anonymous, clock.setMode]);`):
```ts
  // Lost-Pro clamp: if entitlement drops while in a Pro mode, snap back; drop Glyph customization.
  useEffect(() => {
    if (anonymous) return; // anonymous is already handled above
    const clamped = clampMode(clock.mode, isPro);
    if (clamped !== clock.mode) clock.setMode(clamped);
    if (!isPro) setVis({ natal: allVisible(PLANET_KEYS), live: allVisible(PLANET_KEYS) });
  }, [isPro, anonymous, clock.mode, clock.setMode]);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): clamp out of Pro modes + reset Glyphs when Pro is lost"
```

---

## Task 12: AccountView — Restore / Manage / Upgrade

Give signed-in users the Play-required controls and an upgrade entry point.

**Files:**
- Modify: `apps/mobile/components/auth/AccountView.tsx`

- [ ] **Step 1: Add imports + entitlement** — add near the top imports:
```ts
import { useEntitlement } from "../../hooks/useEntitlement";
import { presentProPaywall, restorePurchases, showManageSubscriptions } from "../../lib/purchases";
```
and change the existing `const { user, signOut } = useAuth();` to also grab the session + entitlement:
```ts
  const { user, signOut, session } = useAuth();
  const { isPro } = useEntitlement(session);
```

- [ ] **Step 2: Add the buttons** — directly above the existing `Sign out` `Pressable`, insert:
```tsx
          {!isPro ? (
            <Pressable style={styles.action} onPress={() => void presentProPaywall()}>
              <Text style={styles.actionText}>Upgrade to Pro</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.action} onPress={() => void showManageSubscriptions()}>
              <Text style={styles.actionText}>Manage subscription</Text>
            </Pressable>
          )}
          <Pressable style={styles.action} onPress={() => void restorePurchases()}>
            <Text style={styles.actionText}>Restore purchases</Text>
          </Pressable>
```

- [ ] **Step 3: Add the `action` styles** — in `makeStyles`, add:
```ts
  action: { backgroundColor: p.bg, borderColor: p.border, borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  actionText: { color: p.live, fontSize: 16, fontWeight: "700" },
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/mobile/components/auth/AccountView.tsx
git commit -m "feat(mobile): Account — upgrade / manage / restore subscription"
```

---

## Task 13: Setup runbook

The human/dashboard steps the user runs to go live. Documentation only.

**Files:**
- Create: `docs/setup/2026-06-03-revenuecat-play-billing.md`

- [ ] **Step 1: Write the runbook** — `docs/setup/2026-06-03-revenuecat-play-billing.md` covering, as ordered checklists:
  1. **Google Play Console:** create the app; set up the **payments/merchant profile** (bank details); create two **subscription products** (`pro_monthly`, `pro_yearly`) each with a **3-day free trial** base-plan offer; create an **internal testing** track and add **license testers**.
  2. **RevenueCat:** add the **Google Play app** (upload a Play **service-account JSON** with the right permissions); create the **`pro` entitlement**; create an **offering** with **monthly + yearly packages** mapped to the Play products; build/enable the **paywall** (RevenueCatUI).
  3. **Webhook:** `supabase functions deploy revenuecat-webhook`; `supabase secrets set REVENUECAT_WEBHOOK_SECRET=<random>`; in RevenueCat **Integrations → Webhooks** set the function URL + the same value as the **Authorization** header.
  4. **Apply the migration:** `supabase db push` (or run the migration in the dashboard).
  5. **Keys:** replace the `test_…` key in `app.json` `extra.revenueCatAndroidKey` with the real **`goog_…`** public key; rebuild the dev build.
  6. **Acceptance test:** as a license tester — buy monthly, buy yearly, start trial, cancel, let expire, refund; confirm `isPro` flips in-app **and** the `subscriptions` row updates (RevenueCat "Send test webhook" → check the row).

- [ ] **Step 2: Commit**
```bash
git add docs/setup/2026-06-03-revenuecat-play-billing.md
git commit -m "docs(mobile): RevenueCat + Play Billing setup runbook"
```

---

## Task 14: Final verification + push

- [ ] **Step 1: Full pure-test sweep**

Run: `pnpm --filter @astro/mobile test`
Expected: PASS (all mobile pure tests, including `rcEntitlement` + `proMode`).

Run: `node --test --experimental-strip-types "supabase/functions/_shared/*.test.ts"`
Expected: PASS (`rcEventToRow`).

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @astro/mobile typecheck`
Expected: PASS.

- [ ] **Step 3: Push**
```bash
git push
```

- [ ] **Step 4: Hand off on-device QA** — the user runs the Task 13 acceptance test on the emulator/device against the Test Store (or real Play internal track), since purchases can't be exercised in CI.

---

## Self-Review notes (coverage check vs spec)

- **Schema (provider-agnostic):** Task 1. ✅
- **Client wrapper + identity link + entitlement signal:** Tasks 6–9. ✅
- **Paywall on locked features:** Task 10. ✅
- **Lifecycle (downgrade clamp + vis reset, foreground refresh via listener):** Task 11 + Task 9 listener. ✅
- **Server webhook + pure mapper + guards:** Tasks 4–5. ✅
- **Restore / Manage / Upgrade:** Task 12. ✅
- **Testing (pure unit):** Tasks 2,3,4 + sweep in 14; manual QA in 13/14. ✅
- **Setup runbook + keys/secrets:** Task 13. ✅
- **`useEntitlement` signature unchanged / App.tsx call site intact:** Task 9 (signature preserved). ✅
- **Out of scope (Apple, web Stripe):** not built; schema-ready. ✅
