# Interpretation Layer — Foundation Implementation Plan (Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, platform-agnostic foundation of the interpretation layer: whole-sign house math in `@astro/engine`, plus a new `@astro/interpretations` package (schema, key builders, lookup, gating policy, transit-aspect finder, natal/forecast assembler, and a content-generation script). No Supabase, no UI — everything here is unit-testable in isolation.

**Architecture:** A new workspace package `@astro/interpretations` sits beside `@astro/engine` and depends on engine *types/helpers* one-way. The engine gains one pure helper (whole-sign houses). The package turns engine output (positions + ascendant) into a list of deterministic interpretation **keys** and a tier-aware **gating policy**; the actual text bank is produced by a generation script with a pluggable completion function (the real LLM call and human review are an operational step after this plan).

**Tech Stack:** TypeScript (ESM, `node --test --experimental-strip-types`), Zod for schema validation, pnpm workspaces. Mirrors the existing `@astro/engine` package conventions exactly.

**Spec:** `docs/superpowers/specs/2026-06-08-interpretation-layer-design.md`

**Scope note — this is Plan 1 of 4:**
- **Plan 1 (this doc):** engine houses + `@astro/interpretations` core + generation script. ✅ fully specced, standalone, unit-testable.
- **Plan 2:** Supabase `public.interpretations` table + RLS (Pro gating) + `seed.ts`. Depends on Plan 1's `bank.json`.
- **Plan 3:** Web (Next 15) delivery surface.
- **Plan 4:** Mobile (Expo) delivery + AsyncStorage offline cache.
- Plans 2–4 will be written when reached (they need Plan 1's artifacts to exist and the spec's open UI questions answered — writing them now would require placeholders).

**Branch:** Before Task 1, create a new branch off `main` (do NOT code on `main`):
```bash
git switch -c feat/interpretation-layer main
```

**Conventions:**
- Commit messages: conventional commits, **no attribution footer** (attribution disabled globally).
- Run a package's tests with: `pnpm --filter @astro/interpretations test`.
- Engine tests: `pnpm --filter @astro/engine test`.

---

## File Structure

**Modified (engine):**
- `packages/engine/src/coordinates.ts` — add `houseOf()` + `wholeSignHouses()` (pure geometry).
- `packages/engine/src/index.ts` — export the two new functions.
- `packages/engine/src/coordinates.test.ts` — house tests.

**Created (`@astro/interpretations`):**
- `packages/interpretations/package.json` — package manifest (zod dep, test script).
- `packages/interpretations/tsconfig.json` — mirrors engine's tsconfig.
- `packages/interpretations/src/types.ts` — `Interpretation`, `Bank`, `Subject`.
- `packages/interpretations/src/schema.ts` — Zod schema for an entry + a bank.
- `packages/interpretations/src/keys.ts` — key builders + full key enumerations.
- `packages/interpretations/src/lookup.ts` — `lookup(bank, key)`.
- `packages/interpretations/src/gating.ts` — tier policy (`FREE_TEASER_SUBJECTS`, `visibleField`).
- `packages/interpretations/src/transits.ts` — cross-set transit-aspect finder.
- `packages/interpretations/src/assemble.ts` — `natalRequests()` + `forecastRequests()`.
- `packages/interpretations/src/index.ts` — public surface.
- `packages/interpretations/scripts/generate.ts` — bank generator (pluggable completion).
- `packages/interpretations/data/.gitkeep` — placeholder until the real bank is generated.
- `packages/interpretations/src/*.test.ts` — one test file per module above.

**Modified (root):**
- `package.json` — add `@astro/interpretations` to the root `test` script.

---

## Task 1: Engine — whole-sign house math

**Files:**
- Modify: `packages/engine/src/coordinates.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/src/coordinates.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `packages/engine/src/coordinates.test.ts`:

```ts
import { houseOf, wholeSignHouses } from "./coordinates.ts";
import { PLANET_KEYS, type Positions } from "./types.ts";

test("houseOf: whole-sign houses counted from the ascendant sign", () => {
  // Ascendant at Aries 5° (lon 5) → Aries is house 1.
  assert.equal(houseOf(5, 5), 1);     // same sign as asc (Aries)
  assert.equal(houseOf(0, 5), 1);     // Aries 0 still house 1 (whole-sign)
  assert.equal(houseOf(35, 5), 2);    // Taurus → house 2
  assert.equal(houseOf(335, 5), 12);  // Pisces → house 12
});

test("houseOf: works for a non-Aries ascendant and normalizes input", () => {
  // Ascendant at Leo (lon 130, sign index 4).
  assert.equal(houseOf(125, 130), 1);   // Leo → house 1
  assert.equal(houseOf(155, 130), 2);   // Virgo → house 2
  assert.equal(houseOf(100, 130), 12);  // Cancer → house 12
  assert.equal(houseOf(125 + 360, 130 - 360), 1); // out-of-range still works
});

test("wholeSignHouses: every planet maps to a 1..12 house", () => {
  const pos = Object.fromEntries(PLANET_KEYS.map((k, i) => [k, i * 30])) as Positions;
  const houses = wholeSignHouses(pos, 0); // asc Aries
  for (const k of PLANET_KEYS) {
    assert.ok(houses[k] >= 1 && houses[k] <= 12, `${k} house out of range`);
  }
  assert.equal(houses.sun, 1);   // sun at 0 (Aries) → house 1
  assert.equal(houses.moon, 2);  // moon at 30 (Taurus) → house 2
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @astro/engine test`
Expected: FAIL — `houseOf`/`wholeSignHouses` are not exported from `./coordinates.ts`.

- [ ] **Step 3: Implement the functions** — append to `packages/engine/src/coordinates.ts` (note: `norm` already exists at the top of this file; add `Positions`, `PLANET_KEYS` to the existing imports):

```ts
// Update the existing imports at the top of the file to add Positions + PLANET_KEYS:
//   import { SIGNS, PLANET_KEYS, type PlanetKey, type Sign, type Positions } from "./types.ts";

/** Whole-sign house (1..12) of an ecliptic longitude given the ascendant longitude. */
export function houseOf(planetLon: number, ascLon: number): number {
  const ascSign = Math.floor(norm(ascLon) / 30);
  const bodySign = Math.floor(norm(planetLon) / 30);
  return ((bodySign - ascSign + 12) % 12) + 1;
}

/** Whole-sign house for every body, keyed by planet. */
export function wholeSignHouses(pos: Positions, ascLon: number): Record<PlanetKey, number> {
  const out = {} as Record<PlanetKey, number>;
  for (const k of PLANET_KEYS) out[k] = houseOf(pos[k], ascLon);
  return out;
}
```

- [ ] **Step 4: Export from the engine surface** — in `packages/engine/src/index.ts`, change the coordinates export line:

```ts
export { decanOf, cuspOf, isAnaretic, houseOf, wholeSignHouses } from "./coordinates.ts";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @astro/engine test`
Expected: PASS (all existing engine tests + the 3 new house tests).

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/coordinates.ts packages/engine/src/index.ts packages/engine/src/coordinates.test.ts
git commit -m "feat(engine): add whole-sign house math (houseOf, wholeSignHouses)"
```

---

## Task 2: Scaffold the `@astro/interpretations` package

**Files:**
- Create: `packages/interpretations/package.json`
- Create: `packages/interpretations/tsconfig.json`
- Create: `packages/interpretations/data/.gitkeep`
- Create: `packages/interpretations/src/smoke.test.ts`

- [ ] **Step 1: Create `packages/interpretations/package.json`**

```json
{
  "name": "@astro/interpretations",
  "version": "0.1.0",
  "description": "Keyed astrological interpretation text layer on top of @astro/engine. Pure data + lookup; no DOM, no I/O at runtime.",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "test": "node --test --experimental-strip-types \"src/*.test.ts\"",
    "lint": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@astro/engine": "workspace:*",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `packages/interpretations/tsconfig.json`** (mirrors the engine's):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020"],
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts", "scripts/**/*.ts"],
  "exclude": ["dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: Create `packages/interpretations/data/.gitkeep`** (empty file — keeps the dir until the bank is generated).

- [ ] **Step 4: Create a smoke test** at `packages/interpretations/src/smoke.test.ts` that proves the engine import resolves:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANET_KEYS } from "@astro/engine";

test("smoke: @astro/engine resolves from @astro/interpretations", () => {
  assert.equal(PLANET_KEYS.length, 10);
});
```

- [ ] **Step 5: Install and run**

Run: `pnpm install` (links the new workspace package + installs zod), then `pnpm --filter @astro/interpretations test`
Expected: `pnpm install` succeeds; the smoke test PASSES.

- [ ] **Step 6: Commit**

```bash
git add packages/interpretations/package.json packages/interpretations/tsconfig.json packages/interpretations/data/.gitkeep packages/interpretations/src/smoke.test.ts pnpm-lock.yaml
git commit -m "chore(interpretations): scaffold @astro/interpretations package"
```

---

## Task 3: Types + Zod schema

**Files:**
- Create: `packages/interpretations/src/types.ts`
- Create: `packages/interpretations/src/schema.ts`
- Test: `packages/interpretations/src/schema.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/interpretations/src/schema.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { InterpretationSchema, BankSchema } from "./schema.ts";

const valid = {
  key: "sign:sun:Leo",
  title: "Sun in Leo",
  summary: "Warm, proud, and expressive.",
  body: "A fuller paragraph of interpretation text.",
  keywords: ["pride", "warmth"],
  meta: { model: "test-model", generatedAt: "2026-06-09T00:00:00Z", reviewed: true, v: 1 },
};

test("InterpretationSchema accepts a valid entry", () => {
  assert.doesNotThrow(() => InterpretationSchema.parse(valid));
});

test("InterpretationSchema rejects empty body", () => {
  assert.throws(() => InterpretationSchema.parse({ ...valid, body: "" }));
});

test("InterpretationSchema rejects a non-boolean reviewed flag", () => {
  assert.throws(() => InterpretationSchema.parse({ ...valid, meta: { ...valid.meta, reviewed: "yes" } }));
});

test("BankSchema accepts a keyed map of entries", () => {
  assert.doesNotThrow(() => BankSchema.parse({ [valid.key]: valid }));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @astro/interpretations test`
Expected: FAIL — `./schema.ts` does not exist.

- [ ] **Step 3: Create `packages/interpretations/src/types.ts`**

```ts
import type { PlanetKey } from "@astro/engine";

/** A natal subject is one of the 10 planets or the ascendant (Rising). */
export type Subject = PlanetKey | "ascendant";

export interface InterpretationMeta {
  model: string;       // generating model id
  generatedAt: string; // ISO-8601 timestamp
  reviewed: boolean;   // human-reviewed gate
  v: number;           // content version
}

export interface Interpretation {
  key: string;
  title: string;
  summary: string;     // FREE teaser
  body: string;        // PRO
  keywords?: string[];
  meta: InterpretationMeta;
}

/** A bank is a map keyed by Interpretation.key. */
export type Bank = Record<string, Interpretation>;
```

- [ ] **Step 4: Create `packages/interpretations/src/schema.ts`**

```ts
import { z } from "zod";

export const InterpretationSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  meta: z.object({
    model: z.string().min(1),
    generatedAt: z.string().min(1),
    reviewed: z.boolean(),
    v: z.number().int().nonnegative(),
  }),
});

export const BankSchema = z.record(z.string(), InterpretationSchema);
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @astro/interpretations test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/interpretations/src/types.ts packages/interpretations/src/schema.ts packages/interpretations/src/schema.test.ts
git commit -m "feat(interpretations): add Interpretation types and Zod schema"
```

---

## Task 4: Key builders + enumerations

**Files:**
- Create: `packages/interpretations/src/keys.ts`
- Test: `packages/interpretations/src/keys.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/interpretations/src/keys.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signKey, houseKey, transitKey,
  allSignKeys, allHouseKeys, allTransitKeys,
  TRANSITING_BODIES, TRANSIT_ASPECTS,
} from "./keys.ts";

test("key builders produce deterministic ids", () => {
  assert.equal(signKey("sun", "Leo"), "sign:sun:Leo");
  assert.equal(signKey("ascendant", "Leo"), "sign:ascendant:Leo");
  assert.equal(houseKey("sun", 5), "house:sun:5");
  assert.equal(transitKey("sun", "trine", "moon"), "transit:sun:trine:moon");
});

test("enumerations have the expected counts (v1 scope)", () => {
  // 11 subjects (10 planets + ascendant) x 12 signs
  assert.equal(allSignKeys().length, 11 * 12);
  // 10 planets x 12 houses (ascendant defines house 1, has no house entry)
  assert.equal(allHouseKeys().length, 10 * 12);
  // 5 transiting bodies x 5 major aspects x 10 natal bodies
  assert.equal(allTransitKeys().length, TRANSITING_BODIES.length * TRANSIT_ASPECTS.length * 10);
  assert.equal(TRANSITING_BODIES.length, 5);
  assert.equal(TRANSIT_ASPECTS.length, 5);
});

test("enumerations are unique (no duplicate keys)", () => {
  const all = [...allSignKeys(), ...allHouseKeys(), ...allTransitKeys()];
  assert.equal(new Set(all).size, all.length);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @astro/interpretations test`
Expected: FAIL — `./keys.ts` does not exist.

- [ ] **Step 3: Create `packages/interpretations/src/keys.ts`**

```ts
import { PLANET_KEYS, SIGNS, type PlanetKey, type Sign } from "@astro/engine";
import type { Subject } from "./types.ts";

/** Major aspects used for forecasts. NOTE: the engine's ASPECT_DEFS omit conjunction
 *  (the wheel does not draw it); interpretations define their own set including it. */
export type TransitAspect = "conjunction" | "sextile" | "square" | "trine" | "opposition";

export const SUBJECTS: Subject[] = [...PLANET_KEYS, "ascendant"];
export const TRANSITING_BODIES: PlanetKey[] = ["sun", "moon", "mercury", "venus", "mars"];
export const TRANSIT_ASPECTS: TransitAspect[] = ["conjunction", "sextile", "square", "trine", "opposition"];

export const signKey = (subject: Subject, sign: Sign): string => `sign:${subject}:${sign}`;
export const houseKey = (planet: PlanetKey, house: number): string => `house:${planet}:${house}`;
export const transitKey = (transiting: PlanetKey, aspect: TransitAspect, natal: PlanetKey): string =>
  `transit:${transiting}:${aspect}:${natal}`;

export const allSignKeys = (): string[] =>
  SUBJECTS.flatMap((s) => SIGNS.map((sign) => signKey(s, sign)));

export const allHouseKeys = (): string[] =>
  PLANET_KEYS.flatMap((p) => Array.from({ length: 12 }, (_, i) => houseKey(p, i + 1)));

export const allTransitKeys = (): string[] =>
  TRANSITING_BODIES.flatMap((t) =>
    TRANSIT_ASPECTS.flatMap((a) => PLANET_KEYS.map((n) => transitKey(t, a, n))));
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @astro/interpretations test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/interpretations/src/keys.ts packages/interpretations/src/keys.test.ts
git commit -m "feat(interpretations): add deterministic key builders and enumerations"
```

---

## Task 5: Lookup

**Files:**
- Create: `packages/interpretations/src/lookup.ts`
- Test: `packages/interpretations/src/lookup.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/interpretations/src/lookup.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { lookup } from "./lookup.ts";
import type { Bank } from "./types.ts";

const bank: Bank = {
  "sign:sun:Leo": {
    key: "sign:sun:Leo", title: "Sun in Leo", summary: "s", body: "b",
    meta: { model: "m", generatedAt: "2026-06-09T00:00:00Z", reviewed: true, v: 1 },
  },
};

test("lookup returns the entry for a known key", () => {
  assert.equal(lookup(bank, "sign:sun:Leo")?.title, "Sun in Leo");
});

test("lookup returns null for an unknown key", () => {
  assert.equal(lookup(bank, "sign:moon:Aries"), null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @astro/interpretations test`
Expected: FAIL — `./lookup.ts` does not exist.

- [ ] **Step 3: Create `packages/interpretations/src/lookup.ts`**

```ts
import type { Bank, Interpretation } from "./types.ts";

/** Pure lookup of a single interpretation over a bank. */
export function lookup(bank: Bank, key: string): Interpretation | null {
  return bank[key] ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @astro/interpretations test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/interpretations/src/lookup.ts packages/interpretations/src/lookup.test.ts
git commit -m "feat(interpretations): add pure bank lookup"
```

---

## Task 6: Gating policy

**Files:**
- Create: `packages/interpretations/src/gating.ts`
- Test: `packages/interpretations/src/gating.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/interpretations/src/gating.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isTeaser, visibleField, FREE_TEASER_SUBJECTS } from "./gating.ts";

test("free teaser subjects are sun, moon, ascendant", () => {
  assert.deepEqual([...FREE_TEASER_SUBJECTS], ["sun", "moon", "ascendant"]);
});

test("isTeaser flags only the teaser subjects", () => {
  assert.equal(isTeaser("sun"), true);
  assert.equal(isTeaser("ascendant"), true);
  assert.equal(isTeaser("pluto"), false);
});

test("visibleField: free sees summary only for teaser subjects, nothing otherwise", () => {
  assert.equal(visibleField("free", "sun"), "summary");
  assert.equal(visibleField("free", "pluto"), null);
});

test("visibleField: pro sees the full body for every subject", () => {
  assert.equal(visibleField("pro", "sun"), "body");
  assert.equal(visibleField("pro", "pluto"), "body");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @astro/interpretations test`
Expected: FAIL — `./gating.ts` does not exist.

- [ ] **Step 3: Create `packages/interpretations/src/gating.ts`**

```ts
import type { Subject } from "./types.ts";

/** Signed-in tiers that can see interpretations (anonymous sees none). */
export type Tier = "free" | "pro";

export const FREE_TEASER_SUBJECTS = ["sun", "moon", "ascendant"] as const;

export function isTeaser(subject: Subject): boolean {
  return (FREE_TEASER_SUBJECTS as readonly string[]).includes(subject);
}

/**
 * Which field a tier may see for a subject:
 *  - pro  → "body" (full) for everything
 *  - free → "summary" for teaser subjects, otherwise null (hidden)
 * NOTE: this is policy only. The Pro `body` text is never delivered to a non-Pro
 * client — enforcement lives in Supabase RLS (Plan 2), not in this function.
 */
export function visibleField(tier: Tier, subject: Subject): "summary" | "body" | null {
  if (tier === "pro") return "body";
  return isTeaser(subject) ? "summary" : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @astro/interpretations test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/interpretations/src/gating.ts packages/interpretations/src/gating.test.ts
git commit -m "feat(interpretations): add tier gating policy (teaser vs pro)"
```

---

## Task 7: Transit-aspect finder (cross-set)

**Files:**
- Create: `packages/interpretations/src/transits.ts`
- Test: `packages/interpretations/src/transits.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/interpretations/src/transits.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { transitHits, TRANSIT_DEFS } from "./transits.ts";
import { PLANET_KEYS, type Positions } from "@astro/engine";

// Build a Positions object with everything at 0, then override specific bodies.
const at = (overrides: Partial<Positions>): Positions => ({
  ...(Object.fromEntries(PLANET_KEYS.map((k) => [k, 0])) as Positions),
  ...overrides,
});

test("TRANSIT_DEFS include conjunction through opposition", () => {
  assert.deepEqual(TRANSIT_DEFS.map((d) => d.name), ["conjunction", "sextile", "square", "trine", "opposition"]);
});

test("transitHits finds a transiting Sun trine natal Moon (120°)", () => {
  const now = at({ sun: 120 });   // transiting sun at 120
  const natal = at({ moon: 0 });  // natal moon at 0 → 120° separation = trine
  const hits = transitHits(now, natal);
  assert.ok(hits.some((h) => h.transiting === "sun" && h.aspect === "trine" && h.natal === "moon"));
});

test("transitHits only considers the 5 transiting bodies", () => {
  const now = at({ pluto: 0 });
  const natal = at({ sun: 0 });   // pluto is NOT a transiting body in v1
  const hits = transitHits(now, natal);
  assert.equal(hits.some((h) => h.transiting === "pluto"), false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @astro/interpretations test`
Expected: FAIL — `./transits.ts` does not exist.

- [ ] **Step 3: Create `packages/interpretations/src/transits.ts`**

```ts
import { separation, PLANET_KEYS, type Positions, type PlanetKey } from "@astro/engine";
import { TRANSITING_BODIES, type TransitAspect } from "./keys.ts";

interface TransitDef { name: TransitAspect; angle: number; orb: number; }

/** Major aspects for forecasts (includes conjunction, which the wheel omits). */
export const TRANSIT_DEFS: TransitDef[] = [
  { name: "conjunction", angle: 0, orb: 8 },
  { name: "sextile", angle: 60, orb: 4 },
  { name: "square", angle: 90, orb: 6 },
  { name: "trine", angle: 120, orb: 6 },
  { name: "opposition", angle: 180, orb: 7 },
];

export interface TransitHit {
  transiting: PlanetKey;
  aspect: TransitAspect;
  natal: PlanetKey;
  delta: number; // degrees from exact
}

/** Cross-set: aspects from each transiting body to each natal body (first match wins). */
export function transitHits(transiting: Positions, natal: Positions): TransitHit[] {
  const hits: TransitHit[] = [];
  for (const t of TRANSITING_BODIES) {
    for (const n of PLANET_KEYS) {
      const d = separation(transiting[t], natal[n]);
      for (const def of TRANSIT_DEFS) {
        if (Math.abs(d - def.angle) <= def.orb) {
          hits.push({ transiting: t, aspect: def.name, natal: n, delta: Math.abs(d - def.angle) });
          break;
        }
      }
    }
  }
  return hits;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @astro/interpretations test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/interpretations/src/transits.ts packages/interpretations/src/transits.test.ts
git commit -m "feat(interpretations): add cross-set transit-aspect finder"
```

---

## Task 8: Assembler (natal + forecast requests)

**Files:**
- Create: `packages/interpretations/src/assemble.ts`
- Test: `packages/interpretations/src/assemble.test.ts`

A **request** is a `{ subject, kind, key }` that tells the app *which* interpretation to
fetch/render (the app then pulls the visible field per `visibleField`). The assembler
holds no text — it maps engine output → keys.

- [ ] **Step 1: Write the failing test** at `packages/interpretations/src/assemble.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { natalRequests, forecastRequests } from "./assemble.ts";
import { PLANET_KEYS, type Positions } from "@astro/engine";

const zero = (): Positions => Object.fromEntries(PLANET_KEYS.map((k) => [k, 0])) as Positions;

test("natalRequests: one rising sign + per-planet sign + per-planet house", () => {
  const pos = zero();          // every planet at Aries 0
  const reqs = natalRequests(pos, 0); // ascendant at Aries
  // 1 ascendant-sign request + 10 sign + 10 house = 21
  assert.equal(reqs.length, 1 + PLANET_KEYS.length * 2);
  assert.ok(reqs.some((r) => r.subject === "ascendant" && r.kind === "sign" && r.key === "sign:ascendant:Aries"));
  assert.ok(reqs.some((r) => r.subject === "sun" && r.kind === "sign" && r.key === "sign:sun:Aries"));
  assert.ok(reqs.some((r) => r.subject === "sun" && r.kind === "house" && r.key === "house:sun:1"));
});

test("forecastRequests: maps transit hits to transit keys", () => {
  const natal = zero();
  const now = { ...zero(), sun: 120 }; // transiting sun trine natal moon (both ref 0)
  const reqs = forecastRequests(natal, now);
  assert.ok(reqs.some((r) => r.key === "transit:sun:trine:moon"));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @astro/interpretations test`
Expected: FAIL — `./assemble.ts` does not exist.

- [ ] **Step 3: Create `packages/interpretations/src/assemble.ts`**

```ts
import { signOf, houseOf, PLANET_KEYS, type Positions } from "@astro/engine";
import { signKey, houseKey, transitKey } from "./keys.ts";
import { transitHits } from "./transits.ts";
import type { Subject } from "./types.ts";

export interface NatalRequest {
  subject: Subject;
  kind: "sign" | "house";
  key: string;
}

export interface ForecastRequest {
  subject: Subject; // the transiting body
  kind: "transit";
  key: string;
  delta: number;
}

/** Engine natal output → the list of natal interpretation keys to show. */
export function natalRequests(pos: Positions, ascLon: number): NatalRequest[] {
  const reqs: NatalRequest[] = [
    { subject: "ascendant", kind: "sign", key: signKey("ascendant", signOf(ascLon)) },
  ];
  for (const p of PLANET_KEYS) {
    reqs.push({ subject: p, kind: "sign", key: signKey(p, signOf(pos[p])) });
    reqs.push({ subject: p, kind: "house", key: houseKey(p, houseOf(pos[p], ascLon)) });
  }
  return reqs;
}

/** Natal positions + current positions → the list of forecast (transit) keys. */
export function forecastRequests(natal: Positions, now: Positions): ForecastRequest[] {
  return transitHits(now, natal).map((h) => ({
    subject: h.transiting,
    kind: "transit",
    key: transitKey(h.transiting, h.aspect, h.natal),
    delta: h.delta,
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @astro/interpretations test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/interpretations/src/assemble.ts packages/interpretations/src/assemble.test.ts
git commit -m "feat(interpretations): add natal + forecast request assemblers"
```

---

## Task 9: Public surface (`index.ts`)

**Files:**
- Create: `packages/interpretations/src/index.ts`
- Test: `packages/interpretations/src/index.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/interpretations/src/index.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import * as api from "./index.ts";

test("public surface exports the expected functions and schemas", () => {
  const fns = [
    "signKey", "houseKey", "transitKey",
    "allSignKeys", "allHouseKeys", "allTransitKeys",
    "lookup", "visibleField", "isTeaser",
    "transitHits", "natalRequests", "forecastRequests",
  ];
  for (const name of fns) {
    assert.equal(typeof (api as Record<string, unknown>)[name], "function", `missing ${name}`);
  }
  assert.ok(api.InterpretationSchema, "missing InterpretationSchema");
  assert.ok(api.BankSchema, "missing BankSchema");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @astro/interpretations test`
Expected: FAIL — `./index.ts` does not exist.

- [ ] **Step 3: Create `packages/interpretations/src/index.ts`**

```ts
// Public surface of @astro/interpretations. Web + native both import from here.
export * from "./types.ts";
export { InterpretationSchema, BankSchema } from "./schema.ts";
export {
  signKey, houseKey, transitKey,
  allSignKeys, allHouseKeys, allTransitKeys,
  SUBJECTS, TRANSITING_BODIES, TRANSIT_ASPECTS,
  type TransitAspect,
} from "./keys.ts";
export { lookup } from "./lookup.ts";
export { isTeaser, visibleField, FREE_TEASER_SUBJECTS, type Tier } from "./gating.ts";
export { transitHits, TRANSIT_DEFS, type TransitHit } from "./transits.ts";
export {
  natalRequests, forecastRequests,
  type NatalRequest, type ForecastRequest,
} from "./assemble.ts";
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @astro/interpretations test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/interpretations/src/index.ts packages/interpretations/src/index.test.ts
git commit -m "feat(interpretations): expose public package surface"
```

---

## Task 10: Generation script (pluggable completion)

The real LLM call + human review is an operational step (Task 12). This task builds the
*generator* with a pluggable `complete` function so it is fully unit-testable and the LLM
client is injected (no network in tests, no keys in the package).

**Files:**
- Create: `packages/interpretations/scripts/generate.ts`
- Test: `packages/interpretations/src/generate.test.ts`

- [ ] **Step 1: Write the failing test** at `packages/interpretations/src/generate.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateBank, titleFor, promptFor } from "../scripts/generate.ts";
import { allSignKeys, allHouseKeys, allTransitKeys } from "./keys.ts";
import { BankSchema } from "./schema.ts";

test("titleFor renders human titles per key family", () => {
  assert.equal(titleFor("sign:sun:Leo"), "Sun in Leo");
  assert.equal(titleFor("sign:ascendant:Leo"), "Rising in Leo");
  assert.equal(titleFor("house:sun:5"), "Sun in House 5");
  assert.equal(titleFor("transit:sun:trine:moon"), "Transiting Sun trine natal Moon");
});

test("promptFor mentions the rendered title", () => {
  assert.ok(promptFor("sign:sun:Leo").includes("Sun in Leo"));
});

test("generateBank covers every v1 key and produces a schema-valid bank", async () => {
  const complete = async ({ key }: { key: string }) => ({ summary: `s:${key}`, body: `b:${key}` });
  const bank = await generateBank({ complete, model: "test-model", now: "2026-06-09T00:00:00Z" });
  const expected = [...allSignKeys(), ...allHouseKeys(), ...allTransitKeys()];
  assert.equal(Object.keys(bank).length, expected.length);
  for (const k of expected) assert.ok(bank[k], `missing ${k}`);
  assert.doesNotThrow(() => BankSchema.parse(bank));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @astro/interpretations test`
Expected: FAIL — `../scripts/generate.ts` does not exist.

- [ ] **Step 3: Create `packages/interpretations/scripts/generate.ts`**

```ts
import { allSignKeys, allHouseKeys, allTransitKeys } from "../src/keys.ts";
import type { Bank } from "../src/types.ts";

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Human-readable title for a key (used in UI and to seed the LLM prompt). */
export function titleFor(key: string): string {
  const [kind, a, b, c] = key.split(":");
  if (kind === "sign") return `${a === "ascendant" ? "Rising" : cap(a)} in ${b}`;
  if (kind === "house") return `${cap(a)} in House ${b}`;
  return `Transiting ${cap(a)} ${b} natal ${cap(c)}`; // transit
}

export function promptFor(key: string): string {
  return [
    `Write an astrological interpretation for "${titleFor(key)}".`,
    `Return a JSON object with "summary" (one warm, plain-language sentence — a teaser)`,
    `and "body" (2–3 short paragraphs of fuller interpretation). Avoid fatalism and jargon.`,
  ].join(" ");
}

/** Injected completion: takes a key + prompt, returns the two text fields. */
export type Complete = (input: { key: string; kind: string; prompt: string })
  => Promise<{ summary: string; body: string }>;

/** Build the full v1 bank by calling `complete` for every key. Pure given `complete`. */
export async function generateBank(opts: { complete: Complete; model: string; now: string }): Promise<Bank> {
  const keys = [...allSignKeys(), ...allHouseKeys(), ...allTransitKeys()];
  const bank: Bank = {};
  for (const key of keys) {
    const kind = key.split(":")[0];
    const { summary, body } = await opts.complete({ key, kind, prompt: promptFor(key) });
    bank[key] = {
      key,
      title: titleFor(key),
      summary,
      body,
      meta: { model: opts.model, generatedAt: opts.now, reviewed: false, v: 1 },
    };
  }
  return bank;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @astro/interpretations test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/interpretations/scripts/generate.ts packages/interpretations/src/generate.test.ts
git commit -m "feat(interpretations): add testable bank generator (pluggable completion)"
```

---

## Task 11: Wire the package into the root test script

**Files:**
- Modify: `package.json` (root) — the `test` script currently runs only `@astro/engine`.

- [ ] **Step 1: Inspect the current root test script**

Run: `grep -n '"test"' package.json`
Expected: shows `"test": "pnpm --filter @astro/engine test"`.

- [ ] **Step 2: Update the root `test` script** to include the new package:

```json
"test": "pnpm --filter @astro/engine test && pnpm --filter @astro/interpretations test",
```

- [ ] **Step 3: Run the full root test suite**

Run: `pnpm test`
Expected: PASS — both engine and interpretations test files run green.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: run @astro/interpretations tests from the root test script"
```

---

## Task 12 (operational, not bite-sized code): Generate + review the real bank

This is documented here for completeness; it is a content/ops task, not a TDD coding task,
and may be deferred until Plan 2 (Supabase) is ready to consume `bank.json`.

- [ ] Write a thin runner `packages/interpretations/scripts/run-generate.ts` that constructs a real `Complete` backed by the Anthropic SDK (API key from `process.env`, **never committed**), calls `generateBank({ complete, model, now: new Date().toISOString() })`, and writes `packages/interpretations/data/bank.json`.
- [ ] Run it once; **human-review** every entry, edit as needed, and flip each `meta.reviewed` to `true`.
- [ ] Emit the teaser subset (sun/moon/ascendant `summary` fields) to `packages/interpretations/data/teaser.json`.
- [ ] Add a committed-data test: load `data/bank.json`, assert `BankSchema.parse` passes, assert every key from `allSignKeys()/allHouseKeys()/allTransitKeys()` is present, and assert every `meta.reviewed === true`.
- [ ] Commit `data/bank.json`, `data/teaser.json`, and the data test.

---

## Self-Review (completed by plan author)

**Spec coverage (Plan 1 portion of the spec):**
- §3 package structure → Tasks 2–11 create exactly the listed files (minus Supabase `seed.ts`, which is Plan 2).
- §4.1 entry schema → Task 3. §4.2 keying → Task 4.
- §5 engine house math (`houseOf`/`wholeSignHouses`) → Task 1; assembler integration → Task 8.
- §6 forecast scope (5 transiting bodies, 5 major aspects incl. conjunction) → Tasks 4 + 7.
- §7 gating *policy* → Task 6 (RLS *enforcement* is Plan 2, explicitly out of scope here).
- §8 generation pipeline → Tasks 10 + 12.
- §9 testing (schema, completeness, keying, house math, gating) → Tasks 1,3,4,6,10,12.
- Spec §7.2 RLS, §7.3 delivery, web/mobile → **Plans 2–4** (out of scope, called out).

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N" — every code step has full code. Task 12 is explicitly labelled operational (content generation + human review), not a code placeholder.

**Type consistency:** `Subject`, `Bank`, `Interpretation` defined in Task 3 and reused verbatim in Tasks 4–10. `NatalRequest`/`ForecastRequest` defined in Task 8 and exported in Task 9. `TransitAspect` defined in Task 4, imported in Task 7. `visibleField`/`isTeaser` signatures match between Tasks 6 and 9. The engine `houseOf` signature in Task 1 matches its use in Task 8.

**Known refinement captured:** the engine's `ASPECT_DEFS` omit conjunction (wheel-only); the package defines its own `TRANSIT_DEFS` including conjunction (Task 7) — documented in `keys.ts`/`transits.ts`.
