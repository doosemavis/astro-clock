# MoveStar — Production Access Application Runbook (Google Play)

**Date:** 2026-06-16
**Purpose:** The exact steps to graduate MoveStar from closed testing to **production** on Google Play, incorporating the testing service's "Next steps for production access" guidance.

---

## Where we are (2026-06-16)

- **Closed test LIVE**; testers sourced via the paid tester-exchange (closed + license-tester group).
- **Latest released build: v1.1.0 / versionCode 8** — approved and live to testers 2026-06-16 (superseded vc4).
- **All store declarations GREEN:** Data safety ✅ · real Play Billing ✅ · Content rating ✅ · App content ✅ (confirmed 2026-06-16, no Action-needed) · Store listing (ASO + screenshots) ✅ · Reviewer App-access account + delete-account URL ✅.
- **Only gate left:** satisfy the closed-test duration requirement, then apply for production.

---

## The requirement — two layers

### A. Google's official rule (personal/individual developer account)
Run a closed test with **≥ 12 testers opted in**, continuously, for **≥ 14 days**, *before* you can apply for production access. Then complete Google's **Production access** application; Google reviews it and emails a decision.

### B. The testing service's guidance ("Next steps for production access", **16-day** testing period)
> "These steps are critical for ensuring your production access approval from Google Play."

1. **Release 2–3 app updates during the testing period** — minor changes are fine (bug fixes, UI improvements, small features). Shows active development.
2. **After 14 days, download the "Production Access Report"** from the service's **Reports tab** — it has **pre-filled answers** for Google's production-access form. Use them.
3. **Submit for production once you cross 14 days of testing** (critical timing). The service pads to a **16-day** window for safety.

> These maximize approval odds. #1 and #2 are the service's recommendations (not all Google-mandated), but follow them — you're paying for the service and they raise the likelihood of a clean approval.

---

## Action plan

### Step 1 — Ship 2–3 updates during the testing window  ✅ SATISFIED
Google's uploaded version history for the app shows **versionCodes 2, 3, 4, 8** (4 releases). During the testing window we shipped **at least 2 updates**, which meets the service's 2–3-updates recommendation:
- ✅ **Crash-fix update** (early June, vc 3→4 era) — fixed the closed-test launch crash (React collision + Supabase-env).
- ✅ **v1.1.0 / vc8** (2026-06-16) — onboarding walkthrough, theme switcher, password show/hide, Rate button, header-icon fix.
- ⬜ *Optional:* one more tiny update wouldn't hurt, but it is **not required** — the 2–3 cadence is already met.

> Note: EAS builds vc5/6/7 were iteration builds on 6/6 that were **never uploaded** to Google (5 & 7 finished, 6 errored), which is why Google's list skips from 4 to 8.

**How to ship each minor update (established flow):**
1. Make the change on a branch → merge to `main`.
2. Bump `version` in `apps/mobile/app.json` (patch `1.1.1` for a fix; minor `1.2.0` for a small feature).
3. `eas build --profile production --platform android` — auto-increments versionCode (→ vc9, vc10, …).
4. Download the artifact as **`MoveStar-alpha-vc<N>_<version>.aab`** (naming convention: `MoveStar-<track>-vc<versionCode>_<versionName>.aab`).
5. Play Console → **Closed testing** → **Create new release** → upload **only the new bundle** (don't retain the old vc) → paste "What's new" → **Review & roll out to the SAME track**.

> Each upload does **NOT** reset the 14-day clock. Keep **≥ 12 testers opted in** the entire time.

### Step 2 — After 14 days: download the Production Access Report
- Testing-service dashboard → **Reports tab** → download **"Production Access Report."**
- It contains **pre-filled answers** (tester recruitment, how testing went, feedback gathered, changes shipped) mapped to Google's production-access questionnaire. Keep it open to copy from in Step 3.

### Step 3 — Apply for production access (only after crossing 14 continuous days)
- Play Console → **MoveStar** → **Test and release → Production** → look for **"Apply for production access"** (appears once eligible), or the dashboard's production-access task.
- Complete Google's **production access application** — the questions about your closed test, testers, feedback, and changes. **Paste from the Production Access Report.**
- Submit. **Google reviews the application** — typically a few days, occasionally up to ~2 weeks. Decision arrives by email.

### Step 4 — Once production access is granted: create the Production release
- Play Console → **Production** → **Create new release**.
- **Promote** the latest closed-track build (vc8 or whatever's newest) — no rebuild needed — *or* upload a fresh `.aab`.
- Set release name (`<versionName> (<versionCode>)`), paste "What's new", choose rollout %.
  - Consider a **staged rollout** (e.g., 20% → 50% → 100%) for the first production release to catch issues early.
- **Review & roll out** → Google reviews the production release → goes live on the public Play Store.

---

## Pre-application checklist (verify all green)

- [ ] **≥ 12 testers opted in for 14 continuous days** ← the active gate; watch the clock
- [x] **2–3 updates shipped during the window** — crash-fix + vc8 (Google version history: vc 2, 3, 4, 8)
- [ ] **Production Access Report** downloaded (after day 14)
- [x] Data safety · real Play Billing · Content rating · App content (all green 2026-06-16)
- [x] Store listing (ASO + screenshots)
- [x] Reviewer App-access account + delete-account URL

---

## Key dates (fill in as you go)

| Milestone | Date |
| --- | --- |
| Closed test live / testers flowing | ~2026-06-04 |
| Update #1 released (vc8 / 1.1.0) | 2026-06-16 |
| Update #2 released | _____ |
| Update #3 released (optional) | _____ |
| Day 14 of continuous testing reached | _____ (≈ service's 16-day window) |
| Production Access Report downloaded | _____ |
| Production access application submitted | _____ |
| Production access granted | _____ |
| First production release rolled out | _____ |

---

## Gotchas

- **Don't let the tester count drop below 12** during the 14 days — it breaks continuity and can reset the clock.
- **Same closed track** for every update — switching tracks or editing the tester list can break opt-in continuity.
- **Updates don't reset the clock** — uploading mid-test is encouraged (that's the service's Step 1).
- **License testers cover billing** — the test cohort is on the account-level License testing list, so no one is charged real money.
- **Timing discipline** — apply for production **after** crossing 14 days, not before (the service's "Critical Timing" note).
- **versionCode is EAS-managed** (`appVersionSource: remote` + `autoIncrement`) — it can run ahead of the live Play code; always confirm the new code exceeds what's live (it will, via auto-increment).

---

_Related: `2026-06-16-v1.1.0-release-notes.md`, `2026-06-14-play-store-aso.md`._
