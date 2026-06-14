# Interpretation Layer — Design Spec

**Status:** design (approved scope; pre-implementation)
**Created:** 2026-06-08 · **Spec authored:** 2026-06-09
**Product:** MoveStar (astro-clock)
**Owner:** Moose Davis
**Engine:** `@astro/engine` (pure math; consumed `workspace:*` by web + mobile)

---

## 1. Summary

Add an interpretation / "horoscope" **text layer** on top of `@astro/engine`. The
engine already produces the *left side* of every lookup — which planet sits in which
sign and (now) which house, plus aspects between bodies. This feature layers
**keyed, human-readable interpretation text** on top of those facts, for both **natal**
(who you are) and **forecasts** (daily/weekly, from current transits vs the natal chart).

Text is **LLM-generated at build time**, reviewed by a human, and committed — there are
**no runtime LLM keys or per-request cost**. Free users get a **teaser**; Pro users get
the full set. Pro content is **never shipped to a non-Pro device** — entitlement is
enforced server-side (Supabase RLS), not in client code.

---

## 2. Locked decisions

From brainstorming (2026-06-08) and design review (2026-06-09):

| # | Decision | Notes |
|---|----------|-------|
| 1 | **Scope:** natal **+** forecasts | Forecasts = current transits vs natal chart |
| 2 | **Content source:** LLM-generated **at build time**, reviewed + committed | No runtime keys/cost. Generation pipeline isolated to a dev-only script |
| 3 | **Depth:** planet-in-sign **+** planet-in-house | House layer requires accurate birth time + place |
| 4 | **Gating:** free **teaser** + Pro **full** | Teaser = Sun, Moon, Rising; fits access-tiers |
| 5 | **Architecture:** new sibling package **`@astro/interpretations`** | Peer to engine; engine stays pure |
| 6 | **House system:** **whole-sign only** for v1 | No Placidus/Equal/Koch in v1 (deferred) |
| 7 | **Forecast scope (v1):** transiting Sun/Moon + personal planets (Mercury–Mars), **major aspects only**, vs all natal bodies | Bounds the generated bank to a reviewable size |
| 8 | **Secure gating:** Pro text is **server-gated (Supabase RLS)** — no client-side bypass | Pro prose never lands on a non-Pro device |

---

## 3. Architecture — `@astro/interpretations`

A new workspace package, peer to `@astro/engine`. The engine stays pure math; the
interpretations package depends on engine **types** one-way (engine never depends on it).

```
packages/
  engine/                      @astro/engine (pure math)
    src/coordinates.ts         + wholeSignHouses() / houseOf()  ← only engine change (§5)
  interpretations/             @astro/interpretations  ← NEW
    package.json               workspace:*, "type": "module", exports → ./src/index.ts
    src/
      index.ts                 public surface
      schema.ts                Zod schema + types for one Interpretation entry
      keys.ts                  deterministic key builders (sign / house / transit)
      lookup.ts                pure: key → Interpretation (over an injected bank)
      assemble.ts              engine output → list of lookups (natal + forecast)
      gating.ts                tier policy (FREE_TEASER set; free → summary only)
    data/
      teaser.json              free-tier summaries (Sun/Moon/Rising) — safe to bundle
      bank.json                full reviewed text bank (seeded to Supabase, NOT bundled)
    scripts/
      generate.ts              dev-only; reads API key from env; LLM → data/*.json
      seed.ts                  reads bank.json → upserts Supabase `interpretations` table
    src/*.test.ts              schema validation, completeness, gating
```

**Why a sibling package (Approach A):** mirrors the existing engine pattern exactly;
keeps the engine zero-dep and small (the anonymous Now clock pulls no prose); the
generation pipeline + API keys live in a script that never ships; independently
versionable. Rejected: folder-inside-engine (breaks the engine's pure-math contract,
bloats every consumer) and per-app assets (duplicates the bank, risks drift).

---

## 4. Data model

### 4.1 Entry schema (`schema.ts`)

One shape for every entry. Gating is **field-level** — `summary` is the free teaser,
`body` is Pro:

```ts
interface Interpretation {
  key: string;          // deterministic id (§4.2)
  title: string;        // e.g. "Sun in Leo"
  summary: string;      // 1–2 sentences — FREE teaser
  body: string;         // full text — PRO
  keywords?: string[];
  meta: {
    model: string;      // generating model id
    generatedAt: string;// ISO timestamp
    reviewed: boolean;  // human-reviewed gate (CI fails on false)
    v: number;          // content version
  };
}
```

A Zod schema validates the committed JSON in CI: every required key present, no empty
`body`, `reviewed: true` for all shipped entries.

### 4.2 Keying (`keys.ts`)

Reuses engine types (`PlanetKey`, `Sign`, aspect names) directly — no re-declaration.

| Family | Key format | Count (v1) |
|--------|-----------|------------|
| planet-in-sign | `sign:{planet}:{sign}` | 10 × 12 = **120** |
| planet-in-house | `house:{planet}:{1..12}` | 10 × 12 = **120** |
| transit / forecast | `transit:{transiting}:{aspect}:{natal}` | bounded — see §7 |

---

## 5. Engine integration

The only change to `@astro/engine`: add **pure** whole-sign house geometry (it is
positions/geometry, not prose — fits the engine's contract; keeps interpretations
text-only):

```ts
// packages/engine/src/coordinates.ts
export function houseOf(planetLon: number, ascLon: number): number;     // 1..12
export function wholeSignHouses(ascLon: number): Record<PlanetKey, ...>; // helper
```

Whole-sign: house *n* = the sign counted from the ascendant's sign. No new ephemeris,
robust to fuzzy birth times. Placidus/Equal/Koch are **deferred** (new cusp math,
fragile to birth-time error — not worth it for v1).

The interpretations package consumes engine output and maps it to text — it never
touches Supabase or `isPro`:

```ts
interpretSign(planet, sign): Interpretation
interpretHouse(planet, house): Interpretation
interpretTransit(transiting, aspect, natal): Interpretation
interpretNatal(positions, ascLon): Interpretation[]          // sign + house per planet
interpretForecast(natalPositions, nowPositions): Interpretation[] // via findAspects
```

---

## 6. Forecast scope (v1)

Natal is bounded (120 + 120). Forecasts (transit × aspect × natal) are a larger space,
so v1 is bounded to stay reviewable:

- **Transiting bodies:** Sun, Moon, Mercury, Venus, Mars (fast movers — meaningful
  daily/weekly motion).
- **Aspects:** major only (conjunction, opposition, trine, square, sextile).
- **Natal targets:** all 10 bodies.
- Daily/weekly framing is assembled at runtime from `findAspects(nowPositions, natal)`;
  each hit maps to a `transit:*` entry.

Slow outer-planet transits and minor aspects are deferred to a later release.

---

## 7. Gating & secure delivery (no client-side bypass)

**Principle:** Pro interpretation text must never exist on a non-Pro client. Enforcement
is **server-side (Supabase RLS)** — client code cannot bypass it.

### 7.1 Content split
- **Teaser bank** (`teaser.json`): `summary` for the free-tier bodies (Sun, Moon,
  Rising) only. Zero Pro value → **bundled** in both apps (instant, offline).
- **Pro bank** (`bank.json`): full bodies + all non-teaser entries. **Not bundled.**
  Seeded into a Supabase table and served only to entitled users.

### 7.2 Supabase enforcement
- Table `public.interpretations` (key, title, summary, body, keywords, meta), seeded
  from `bank.json` via `scripts/seed.ts` at deploy (idempotent upsert).
- **RLS policies:**
  - teaser/`summary` rows → readable by any authenticated user;
  - full `body` rows → readable only when an **active Pro subscription** exists for
    `auth.uid()`, referencing the existing `public.subscriptions` table
    (`status = 'active'` and not expired).
- Both web and mobile read Pro content via Supabase with the user's JWT → Postgres
  evaluates the policy → a free user's query simply returns no Pro rows. There is no
  client flag to flip.

### 7.3 Platform delivery
- **Web (Next 15 / React 19):** teaser static; Pro fetched server-side / via
  authenticated query, never sent to the client unless entitled. Online anyway.
- **Mobile (Expo, offline):** teaser bundled (offline). Pro fetched from Supabase on
  first unlock, then **cached in AsyncStorage** for offline re-read. Free users never
  receive Pro rows → nothing to extract.
- **Anonymous:** nothing (consistent with anonymous = Now only).

### 7.4 Trade-off (accepted)
Pro interpretations require **connectivity on first unlock**, then read offline from
cache. The Now clock, natal chart math, and the free teaser remain fully offline. This
is the deliberate cost of a real (non-bypassable) paywall.

---

## 8. Generation & review pipeline

1. `scripts/generate.ts` (dev-only; API key from env) enumerates every key (§4.2),
   calls the LLM, writes `data/bank.json` with provenance (`reviewed: false`).
2. **Human review** edits/approves text and flips `reviewed: true`. Only reviewed
   entries are committed; CI fails the build on any `reviewed: false` or empty `body`.
3. `scripts/seed.ts` upserts the reviewed `bank.json` into Supabase at deploy.
4. The teaser subset is emitted to `teaser.json` for bundling.

Regeneration is deliberate and reviewed — committed JSON is the source of truth, not
raw LLM output.

---

## 9. Testing

- **Schema + completeness:** Zod-validate the committed JSON; assert every planet×sign
  and planet×house key exists, no empty bodies, all `reviewed: true`.
- **Keying:** round-trip key builders (`keys.ts`) — deterministic, collision-free.
- **House math:** unit-test `houseOf` / `wholeSignHouses` against known charts.
- **Gating:** `gating.ts` returns teaser-only for free, full for Pro; pure-function tests.
- **RLS:** integration test that a non-Pro JWT cannot read `body` rows and a Pro JWT can.
- Run via `npm --prefix packages/interpretations test` (node --test, matching engine).

---

## 10. Out of scope (v1) / deferred

- Placidus / Equal / Koch house systems (whole-sign only).
- Slow outer-planet transits, minor aspects in forecasts.
- Synastry/compare interpretations (already a separate post-launch Pro feature).
- Aspect-pattern interpretations (grand trine, T-square, etc.).
- Localization / multiple languages.

---

## 11. Open questions

- Exact free-teaser set — Sun + Moon + Rising confirmed; include any one more?
- Forecast cadence in UI — daily, weekly, or both surfaces?
- Whether web reads Pro via a Next route handler vs direct Supabase client query
  (both are server-enforced; pick during implementation).

---

## 12. Next steps

1. (Optional) Record the architecture choice as **ADR-0001** (Approach A + RLS gating).
2. `superpowers:writing-plans` → implementation plan (phased: engine house math →
   package skeleton + schema → generation script → seed + RLS → web delivery →
   mobile delivery + cache).
3. **Create a new branch off `main`** before any code (do NOT code on main).
