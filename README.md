# Astro App

A **living astrological chart** — the zodiac ring stays fixed while real planets move
across it at their true ephemeris positions. Web MVP first; native (Expo) later.

Design: [`docs/specs/2026-05-31-web-mvp-design.md`](docs/specs/2026-05-31-web-mvp-design.md).

## Layout

```
prototype/          Reference mockup (single-file): index.html + ephemeris.js
packages/engine/    Pure TS engine (ephemeris, ascendant, aspects, geometry, theme, data)
apps/web/           Next.js app (App Router, TS)
supabase/           schema.sql (Postgres + RLS + auth trigger)
docs/specs/         Design docs
```

The engine is a **faithful, tested port** of the prototype: every constant, aspect orb,
color, and formula comes straight from `prototype/`. Its regression test reproduces the
reference natal chart 10/10.

## Getting started

```bash
pnpm install                              # 1. install (run once)
pnpm --filter @astro/engine test          # 2. engine regression gate (7 tests)
cp .env.example apps/web/.env.local       # 3. fill in Supabase + Stripe keys
#   apply supabase/schema.sql in the Supabase SQL editor (or: supabase db push)
pnpm dev                                  # 4. dev server
```

## Status — scaffolded (faithful port from prototype)

**Done & verified:**
- Monorepo (pnpm workspaces) + git.
- `packages/engine`: ported ephemeris/ascendant/aspects/chart-geometry/theme/data —
  **7/7 regression tests pass**.
- `apps/web`: Next.js skeleton; Stripe checkout/webhook/portal; Supabase client/server;
  Option-A paywall gate (`lib/subscription.ts`); placeholder marketing + chart pages
  (chart page smoke-tests the engine end-to-end).
- `supabase/schema.sql`: profiles, birth_charts, subscriptions + RLS + new-user trigger.

**TODO (next implementation pass):**
- [ ] Port the prototype wheel into React/SVG components under `apps/web/components/Chart/*`
      (dial + curved labels, natal tokens + tooltips, live glyphs + tooltips, aspects,
      the custom date/time picker, the side panel, all four views, themes).
- [ ] Auth pages (email + Google) + `middleware.ts` session refresh + `/auth/callback`.
- [ ] Birth form -> persist to `birth_charts`.
- [ ] Wire Paywall to `entitlements()`; create Stripe products/prices; set env.
- [ ] Landing page + share-to-image (the viral seed).
- [ ] Deploy: Vercel + Supabase.

## Engine note

`packages/engine/src/ephemeris.ts` uses the prototype's verified Schlyter math. Upgrade
path: swap the body of `positions()` to `astronomy-engine` (MIT) — the public surface
stays identical and `ephemeris.test.ts` is the gate that must stay green.
