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

test("natalRequests: non-zero position routes signOf/houseOf args correctly", () => {
  const pos = zero();
  pos.sun = 95;       // Cancer (90–120°), sign index 3
  const reqs = natalRequests(pos, 30); // Taurus ascendant (sign index 1)
  // Sun in Cancer
  assert.ok(reqs.some((r) => r.subject === "sun" && r.kind === "sign" && r.key === "sign:sun:Cancer"));
  // Sun sign 3, asc sign 1 → whole-sign house = ((3 - 1 + 12) % 12) + 1 = 3
  assert.ok(reqs.some((r) => r.subject === "sun" && r.kind === "house" && r.key === "house:sun:3"));
});

test("forecastRequests: maps transit hits to transit keys", () => {
  const natal = zero();
  const now = { ...zero(), sun: 120 }; // transiting sun trine natal moon (both ref 0)
  const reqs = forecastRequests(natal, now);
  assert.ok(reqs.some((r) => r.key === "transit:sun:trine:moon"));
});
