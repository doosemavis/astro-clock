# Astro App — Web MVP Design

**Date:** 2026-05-31
**Status:** Approved; scaffolding from the prototype
**Author:** moosedavis + Claude

---

## 1. Concept

A **living astrological chart**: the zodiac ring stays fixed while real planets move
across it at their true ephemeris positions. The differentiator versus incumbents
(Co–Star, The Pattern, Sanctuary) is the **visual, animated chart as the product** — not
text horoscopes. The chart is inherently screenshot-able, which is the organic growth
loop for a solo founder in a crowded, well-funded market.

The interactive prototype in `prototype/` (`index.html` + `ephemeris.js`) is the **direct
guide** for this build: every constant, aspect orb, color, and behavior is ported from it.

## 2. Goals (MVP)

- Web app rendering a user's **real, live-updating** chart in the browser.
- **Accounts**: email + Google sign in / sign up (Supabase Auth).
- **Payments**: Stripe subscription (monthly + annual) + Customer Portal.
- **Paywall (Option A)**: natal chart free; the *living* experience paid.
- Shared engine package that a later **native app** (Expo) reuses verbatim.

## 3. Non-Goals (deferred)

Native apps / widgets / wallpaper · live worldwide geocoding (MVP = curated cities +
manual lat/lon) · Swiss Ephemeris · horoscope text · social/compatibility ·
server-side paywall hardening.

## 4. Architecture

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router) + React + TS | Prototype is React-shaped; SSR for marketing |
| Monorepo | pnpm workspaces | `packages/engine` reused by web now, native later |
| Data + Auth | Supabase (Postgres, Auth, Storage) | One vendor: DB + email/Google auth + image hosting |
| Payments | Stripe (Checkout, Portal, webhooks) | Standard subscription stack |
| Hosting | Vercel (web) + Supabase (data) | |
| Ephemeris | Verified Schlyter port now; `astronomy-engine` (MIT) later | No AGPL trap |

### How the prototype maps to packages

The prototype's **pure logic** moves into `packages/engine` (no DOM):
- `ephemeris.js` → `engine/src/ephemeris.ts` (exact port: positions, sunAltitude, ascendant)
- aspect array + `aspectBetween` → `engine/src/aspects.ts`
- `P()`, `signName`, `degInSign`, `fmtDMS`, `declutter` → `engine/src/chart.ts`
- `NIGHT`/`DAY` palettes, `mixColor`, `aspectColor`, `solarT` → `engine/src/theme.ts`
- `DEFAULT_BIRTH`, `CITIES`, `OFFSET_CITY`, `TZ_STD`/`TZ_DAY` → `engine/src/data.ts`

The prototype's **DOM/animation layer** (buildDial/buildNatal/buildLive/drawAspects, the
date picker, the panel) is re-implemented as **React components** in `apps/web` that call
the engine. Behavior is preserved 1:1.

### Repo layout

```
astro-clock/
  prototype/                 reference mockup (index.html + ephemeris.js)
  packages/engine/src/       types, ephemeris, aspects, chart, theme, data, index (+ tests)
  apps/web/
    app/(marketing)/page.tsx landing + shareable hook
    app/chart/page.tsx       the living chart
    app/account/page.tsx
    app/api/stripe/{checkout,portal,webhook}/route.ts
    app/auth/callback/route.ts
    components/Chart/*        React/SVG port of the wheel
    components/BirthForm.tsx, Paywall.tsx
    lib/{supabase,stripe,subscription}.ts
    middleware.ts
  supabase/schema.sql
  docs/specs/
```

## 5. Data Model (Postgres / Supabase)

- **profiles**(id pk→auth.users, display_name, created_at)
- **birth_charts**(id, user_id→auth.users, name, birth_date, birth_time, tz_offset,
  is_dst, lat, lon, place_label, is_primary, created_at) — mirrors the prototype's
  birth object (`DEFAULT_BIRTH`: date "1992-07-29", time "14:28", offset -6, dst true …).
- **subscriptions**(user_id pk, stripe_customer_id, stripe_subscription_id, status,
  price_id, current_period_end) — written by the Stripe webhook (service role).

RLS: owner-only read/write on profiles + birth_charts; subscriptions readable by owner,
writable only by service role.

## 6. Paywall (Option A)

Free: natal chart (fixed glyphs, degrees, tooltips, curved labels) + share-image.
Paid: Now/Date/Range living views, transits, all themes + Auto day/night.
Gate: `status ∈ {active, trialing}`. **Soft paywall** (client-side ephemeris is
bypassable) — standard for the class; harden when widgets need server assets.

## 7. Engine fidelity gate

`engine/src/ephemeris.ts` is an exact TS port of the prototype's verified Schlyter math.
A regression test feeds the reference birth (1992-07-29 19:28 UTC, Jonesboro) and asserts
Sun/Moon/Merc/Venus Leo, Jupiter Virgo, Saturn Aquarius, Uranus/Neptune Capricorn, Pluto
Scorpio, Ascendant Scorpio — the same 10/10 check we ran on the prototype. This test is
the gate that must stay green if `positions()` is later swapped to astronomy-engine.

## 8. Build order

1. `packages/engine` (port + test) — done in this scaffold.
2. `apps/web` Chart components (React/SVG port of the wheel).
3. Supabase schema + auth + birth-form persistence.
4. Stripe checkout/webhook/portal + gating.
5. Landing + share-to-image.
6. Deploy.

## 9. Risks / honest notes

- Distribution is the hard 80%; visual virality is the wedge.
- Soft paywall (§6). MIT ephemeris chosen to avoid AGPL. Manual DST toggle for now.
