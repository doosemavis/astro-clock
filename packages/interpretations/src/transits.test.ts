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
