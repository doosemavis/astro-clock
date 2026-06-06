import { test } from "node:test";
import assert from "node:assert/strict";
import { decanOf, cuspOf, isAnaretic } from "./coordinates.ts";

// Aries 0-9.99 = 1st decan, ruler Mars; 10-19.99 = 2nd, Sun; 20-29.99 = 3rd, Venus.
test("decanOf: Aries decans + Hellenistic-face rulers", () => {
  assert.deepEqual(decanOf(0), { decan: 1, ruler: "mars" });
  assert.deepEqual(decanOf(9.99), { decan: 1, ruler: "mars" });
  assert.deepEqual(decanOf(10), { decan: 2, ruler: "sun" });
  assert.deepEqual(decanOf(20), { decan: 3, ruler: "venus" });
});

test("decanOf: face cycle continues across signs", () => {
  // Taurus (30-60): 1st=Mercury, 2nd=Moon, 3rd=Saturn
  assert.deepEqual(decanOf(30), { decan: 1, ruler: "mercury" });
  assert.deepEqual(decanOf(40), { decan: 2, ruler: "moon" });
  assert.deepEqual(decanOf(50), { decan: 3, ruler: "saturn" });
  // Gemini 1st (60-70) = Jupiter, then the 7-cycle wraps: Gemini 2nd = Mars
  assert.deepEqual(decanOf(60), { decan: 1, ruler: "jupiter" });
  assert.deepEqual(decanOf(70), { decan: 2, ruler: "mars" });
});

test("decanOf: normalizes out-of-range longitudes", () => {
  assert.deepEqual(decanOf(360), { decan: 1, ruler: "mars" }); // == 0
  assert.deepEqual(decanOf(-350), { decan: 2, ruler: "sun" }); // == 10
});

test("cuspOf: within 1deg of a sign boundary", () => {
  assert.deepEqual(cuspOf(0.5), { onCusp: true, from: "Pisces", to: "Aries" });   // start of Aries
  assert.deepEqual(cuspOf(29.5), { onCusp: true, from: "Aries", to: "Taurus" });  // end of Aries
  assert.equal(cuspOf(15), null);                                                 // mid-sign
  assert.equal(cuspOf(0, 0), null);                                               // orb 0, exactly at boundary not counted
});

test("isAnaretic: only the final degree", () => {
  assert.equal(isAnaretic(29), true);
  assert.equal(isAnaretic(29.99), true);
  assert.equal(isAnaretic(30), false);   // == Taurus 0
  assert.equal(isAnaretic(28.99), false);
  assert.equal(isAnaretic(59.5), true);  // Taurus 29.5
});
