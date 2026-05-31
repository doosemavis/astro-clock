// Regression gate: the engine must reproduce the known reference natal chart.
// Run: node --test --experimental-strip-types src/ephemeris.test.ts
// Must stay green if positions() is later swapped to astronomy-engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { positions, ascendant, birthInstant } from "./ephemeris.ts";
import { signOf, formatDMS, declutter } from "./chart.ts";
import { aspectBetween, findAspects } from "./aspects.ts";
import { tzAbbrev } from "./data.ts";
import type { BirthData } from "./types.ts";

// 1992-07-29, 2:28 PM Jonesboro AR (CST -6 + DST) -> 19:28 UTC. Scorpio rising.
const REF: BirthData = {
  date: "1992-07-29", time: "14:28", tzOffset: -6, isDst: true,
  lat: 35.8423, lon: -90.7043, placeLabel: "Jonesboro, AR",
};

test("birthInstant resolves DST correctly to 19:28 UTC", () => {
  assert.equal(birthInstant(REF).toISOString(), "1992-07-29T19:28:00.000Z");
});

test("natal positions match the reference chart (10/10)", () => {
  const p = positions(birthInstant(REF));
  assert.equal(signOf(p.sun), "Leo");
  assert.equal(signOf(p.moon), "Leo");
  assert.equal(signOf(p.mercury), "Leo");
  assert.equal(signOf(p.venus), "Leo");
  assert.equal(signOf(p.mars), "Gemini");
  assert.equal(signOf(p.jupiter), "Virgo");
  assert.equal(signOf(p.saturn), "Aquarius");
  assert.equal(signOf(p.uranus), "Capricorn");
  assert.equal(signOf(p.neptune), "Capricorn");
  assert.equal(signOf(p.pluto), "Scorpio");
});

test("ascendant is Scorpio; location changes it", () => {
  assert.equal(signOf(ascendant(birthInstant(REF), REF.lat, REF.lon)), "Scorpio");
  assert.notEqual(signOf(ascendant(birthInstant(REF), 35.68, 139.69)), "Scorpio");
});

test("formatDMS rolls 29°60' into the next sign", () => {
  assert.equal(formatDMS(29.99), "29° Aries 59'");
  assert.equal(formatDMS(119.991), "29° Cancer 59'");
});

test("declutter spreads the Leo stellium so glyphs don't overlap", () => {
  const disp = declutter(positions(birthInstant(REF)));
  const leo = ["moon", "sun", "mercury", "venus"]
    .map(k => disp[k as keyof typeof disp]).sort((a, b) => a - b);
  for (let i = 1; i < leo.length; i++) assert.ok(leo[i] - leo[i - 1] >= 7.99);
});

test("aspectBetween + findAspects detect tiers", () => {
  assert.equal(aspectBetween(0, 180)?.name, "opposition");
  const majorsOnly = findAspects(positions(birthInstant(REF)), { major: true, minor: false });
  assert.ok(majorsOnly.every(h => h.def.tier === "major"));
});

test("tzAbbrev resolves DST to CDT", () => {
  assert.equal(tzAbbrev(-6, true), "CDT");
  assert.equal(tzAbbrev(-6, false), "CST");
  assert.equal(tzAbbrev(9, false), "JST");
});
