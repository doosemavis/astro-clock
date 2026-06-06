import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCoordinateRows } from "./coordinateRows.ts";
import { PLANET_KEYS } from "@astro/engine";
import type { Positions } from "@astro/engine";

// Minimal positions: all bodies at 0 except a couple we assert on.
function pos(overrides: Partial<Positions>): Positions {
  const base = Object.fromEntries(PLANET_KEYS.map((k) => [k, 0])) as Positions;
  return { ...base, ...overrides };
}

test("buildCoordinateRows: one row per planet, in PLANET_KEYS order", () => {
  const rows = buildCoordinateRows(pos({}));
  assert.equal(rows.length, PLANET_KEYS.length);
  assert.deepEqual(rows.map((r) => r.key), PLANET_KEYS);
});

test("buildCoordinateRows: derives sign, degree, decan, anaretic, cusp", () => {
  // sun at Pisces 0deg29' = 330 + 29/60 ; moon at Aries 29.5 (anaretic + cusp to Taurus)
  const rows = buildCoordinateRows(pos({ sun: 330 + 29 / 60, moon: 29.5 }));
  const sun = rows.find((r) => r.key === "sun")!;
  assert.equal(sun.sign, "Pisces");
  assert.equal(sun.dms, "0°29'");
  assert.equal(sun.decan, 1);
  assert.equal(sun.anaretic, false);

  const moon = rows.find((r) => r.key === "moon")!;
  assert.equal(moon.sign, "Aries");
  assert.equal(moon.dms, "29°30'");
  assert.equal(moon.decan, 3);
  assert.equal(moon.anaretic, true);
  assert.equal(moon.cusp?.to, "Taurus");
});
