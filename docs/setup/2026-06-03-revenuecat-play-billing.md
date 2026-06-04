# RevenueCat + Google Play Billing — Setup Runbook

**Architecture:** RevenueCat is the source of truth for subscription state. The app reads the entitlement directly from `CustomerInfo` (no network round-trip required); the RevenueCat webhook mirrors that state into `public.subscriptions` for server-side access. See the [design spec](../specs/2026-06-03-google-play-billing-design.md) and [implementation plan](../plans/2026-06-03-google-play-billing.md) for full context.

---

## 1. Google Play Console

### 1.1 Create the app

- [ ] Go to [Google Play Console](https://play.google.com/console) → **All apps → Create app**.
- [ ] Fill in app name, default language, and choose **App** (not game).
- [ ] Accept the Developer Program Policies and Play App Signing agreement.
- [ ] Complete the store listing setup wizard enough to unlock the subscriptions section (at minimum: short description, full description, icon, feature graphic, at least two screenshots).

### 1.2 Set up the payments / merchant profile

- [ ] In Play Console → **Payments profile** (top-right account menu), create or link a Google Payments merchant account.
- [ ] Enter bank account details and tax information. Google must approve the merchant profile before you can sell subscriptions — approval typically takes 1–3 business days.
- [ ] Verify the profile status shows **Active** before proceeding to subscription creation.

### 1.3 Create subscription products

- [ ] In Play Console → your app → **Monetise → Subscriptions → Create subscription**.
- [ ] Create the **monthly** product:
  - Product ID: `pro_monthly`
  - Name: "Pro Monthly"
  - Description: brief description for the Play Store
  - Save, then open the product and click **Add base plan**.
  - Base plan ID: `pro_monthly_base`
  - Billing period: **1 month**
  - Set your price (e.g. $3.99/month) and activate the base plan.
  - Under the base plan, click **Add offer** → choose **Free trial**.
  - Set trial duration: **3 days**; eligibility: new subscribers only.
  - Activate the offer.
- [ ] Create the **yearly** product:
  - Product ID: `pro_yearly`
  - Name: "Pro Yearly"
  - Add base plan: `pro_yearly_base`, billing period **1 year**, set your price.
  - Add a **3-day free trial** offer, same way as above.
  - Activate both base plan and offer.
- [ ] Confirm both `pro_monthly` and `pro_yearly` show status **Active** in the Subscriptions list.

### 1.4 Internal testing track & license testers

- [ ] In Play Console → your app → **Release → Testing → Internal testing → Create new release**.
- [ ] Upload an AAB (you can use a debug/unsigned build at this stage just to unlock the track).
- [ ] Under **Internal testing → Testers**, add the Gmail addresses that should test without real charges (yourself, QA, etc.).
- [ ] In Play Console → **Setup → License testing** (account-level setting), add those same Gmail addresses as **license testers**. This is what prevents real charges during testing — the Internal Testing track membership alone does not.
- [ ] Confirm the license testers list is saved.

---

## 2. RevenueCat

### 2.1 Add the Google Play app and upload the service-account key

- [ ] Log in to [app.revenuecat.com](https://app.revenuecat.com) and open your project (or create one).
- [ ] **Project settings → Apps → + New app** → choose **Google Play Store**.
- [ ] Enter the Play Store package name (e.g. `com.yourcompany.astroclock`).
- [ ] To create the service-account JSON:
  - In Google Play Console → **Setup → API access**, link to (or create) a Google Cloud project.
  - In that Cloud project, create a **service account** with the role **Service Account User**, then grant it Play Developer API access from the Play Console (Permissions: **View financial data, Manage orders, Manage subscriptions**).
  - Download the service-account JSON key file.
- [ ] Back in RevenueCat, upload the service-account JSON under **Service credentials**.
- [ ] Enable **Real-time Developer Notifications (RTDN)**: RevenueCat will display a Pub/Sub topic name; copy it into Play Console → your app → **Monetise → Subscriptions → Real-time developer notifications**, paste the topic, and click **Save**.
- [ ] Verify the RevenueCat app shows status **Connected**.

### 2.2 Create the `pro` entitlement

- [ ] In RevenueCat project → **Entitlements → + New entitlement**.
- [ ] Identifier: **`pro`** (must match `PRO_ENTITLEMENT = "pro"` in the app — do not change it).
- [ ] Display name: "Pro".
- [ ] Save.

### 2.3 Create the offering and packages

- [ ] In RevenueCat → **Offerings → + New offering**.
- [ ] Identifier: `default` (or a custom name — the app uses `getOfferings().current`).
- [ ] Display name: "Default".
- [ ] Inside the offering, click **+ Add package**:
  - Monthly package: identifier `$rc_monthly`, attach `pro_monthly` (Play product ID + base plan `pro_monthly_base`).
  - Yearly package: identifier `$rc_annual`, attach `pro_yearly` (Play product ID + base plan `pro_yearly_base`).
- [ ] Link both products to the **`pro`** entitlement: in Entitlements → `pro` → **Attach**, select both products.
- [ ] Set the offering as **Current** (the green star / "Make current" button).

### 2.4 Enable the paywall (RevenueCatUI)

- [ ] In the offering, open **Paywall** → click **Create paywall**.
- [ ] Choose a template, configure copy and colors to match the app.
- [ ] **Publish** the paywall so it is served to the app.

### 2.5 Copy the Android public SDK key

- [ ] In RevenueCat → **Project settings → Apps** → click the Google Play app entry.
- [ ] Copy the **Public API key** (starts with `goog_`). You will paste it in Section 5 below.

---

## 3. Webhook

- [ ] Deploy the webhook function:
  ```bash
  supabase functions deploy revenuecat-webhook
  ```
- [ ] Generate a strong random secret (e.g. `openssl rand -hex 32`) and set it:
  ```bash
  supabase secrets set REVENUECAT_WEBHOOK_SECRET=<your-random-value>
  ```
  Keep this value — you will enter it in RevenueCat next.
- [ ] Note the deployed function URL:
  ```
  https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
  ```
- [ ] In RevenueCat → **Integrations → Webhooks → + New webhook**:
  - URL: the Supabase function URL above.
  - Under **Authorization header**, set the value to the **same secret** you passed to `supabase secrets set` (the function compares the incoming `Authorization` header to `REVENUECAT_WEBHOOK_SECRET`).
  - Events to send: at minimum `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `REFUND`, `SUBSCRIBER_ALIAS`.
- [ ] Click **Test webhook** — you should see a `200` response in the RevenueCat UI and a new row (or upsert) in `public.subscriptions`.

---

## 4. Apply the database migration

- [ ] Confirm the migration file is present:
  ```
  supabase/migrations/20260603120000_subscriptions_provider_agnostic.sql
  ```
- [ ] Push it to the remote database:
  ```bash
  supabase db push
  ```
  Alternatively, open the Supabase Dashboard → **SQL Editor**, paste the migration SQL, and run it.
- [ ] Verify the `public.subscriptions` table has `provider` and `product_id` columns (check via the Table Editor or `\d public.subscriptions` in psql).

---

## 5. Keys — wire the Android SDK key into the app

- [ ] Open `apps/mobile/app.json`.
- [ ] Replace the placeholder value in:
  ```json
  "extra": {
    "revenueCatAndroidKey": "test_placeholder"
  }
  ```
  with the real `goog_…` public key you copied in step 2.5.
- [ ] Rebuild the native Android app so the config plugin picks up the new key:
  ```bash
  npx expo run:android
  ```
  or, for a production/release build:
  ```bash
  eas build --platform android
  ```
- [ ] Confirm the app launches without a RevenueCat initialisation error in the logs.

---

## 6. Acceptance test (run as a license tester)

Run each scenario on a physical Android device signed in with a license-tester Google account. After each action, check **both** the in-app state and the database row.

### 6.1 Monthly purchase
- [ ] Open the paywall; purchase the **monthly** plan.
- [ ] Confirm `isPro` (derived from `isProFromCustomerInfo`) flips to `true` in the app.
- [ ] In Supabase → `public.subscriptions`: confirm a row exists with `provider = 'google_play'`, `product_id = 'pro_monthly'`, `status = 'active'`.

### 6.2 Yearly purchase
- [ ] (Refund/cancel the monthly first if needed via Play Console → **Order management**.)
- [ ] Purchase the **yearly** plan.
- [ ] Confirm `isPro` is `true`; confirm the subscription row has `product_id = 'pro_yearly'`.

### 6.3 Free trial
- [ ] If the license-tester account has not previously subscribed, the trial offer should appear on the paywall.
- [ ] Start the free trial for either product.
- [ ] Confirm `isPro` is `true` during the trial period.
- [ ] In the subscription row, confirm `status = 'active'` (or a trial-specific status, depending on your webhook handler).

### 6.4 Cancellation
- [ ] Cancel the subscription via Play Store → **Subscriptions** (the subscription stays active until the period ends).
- [ ] Use RevenueCat → **Customer view** → **Send test webhook** → `CANCELLATION` event to trigger the webhook immediately without waiting.
- [ ] Confirm `isPro` remains `true` until period end (grace behaviour), or `false` if the webhook sets `status = 'cancelled'` — verify this matches your intended UX.

### 6.5 Expiration
- [ ] Use RevenueCat **Send test webhook** → `EXPIRATION` event.
- [ ] Confirm `isPro` flips to `false` in the app.
- [ ] Confirm the subscription row `status = 'expired'` (or equivalent).

### 6.6 Refund
- [ ] Issue a refund via Play Console → **Order management**, or use RevenueCat test webhook → `REFUND`.
- [ ] Confirm `isPro` flips to `false`; confirm subscription row updated accordingly.

---

**Done.** Once all acceptance-test checks pass, the integration is live and ready for open testing / production rollout.
