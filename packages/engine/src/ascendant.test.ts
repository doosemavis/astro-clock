import { test } from "node:test";
import assert from "node:assert/strict";
import { ascendant } from "./ephemeris.ts";
import { signOf } from "./chart.ts";

// Jonesboro, AR — the reference birth location (DEFAULT_BIRTH).
const LAT = 35.8423;
const LON = -90.7043;

test("ascendant: Jonesboro 1992-07-29 2:28 PM CDT (19:28 UTC) rises Scorpio", () => {
  // CDT is UTC-5 (Central + daylight saving), so 14:28 local = 19:28 UTC.
  const cdt = new Date(Date.UTC(1992, 6, 29, 19, 28));
  assert.equal(signOf(ascendant(cdt, LAT, LON)), "Scorpio");
});

test("ascendant: the 1-hour DST error (treated as CST, 20:28 UTC) wrongly rises Sagittarius", () => {
  // Picking the *standard* Central offset (UTC-6) for a summer birth with no DST flag
  // puts the instant one hour late, which tips the fast-moving ascendant into the next sign.
  const cstMistake = new Date(Date.UTC(1992, 6, 29, 20, 28));
  assert.equal(signOf(ascendant(cstMistake, LAT, LON)), "Sagittarius");
});
