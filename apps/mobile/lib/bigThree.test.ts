import { test } from "node:test";
import assert from "node:assert/strict";
import { bigThreeLabel, bigThreeInstantMs } from "./bigThree.ts";

test("bigThreeLabel: with ascendant shows all three", () => {
  assert.equal(bigThreeLabel("Gemini", "Gemini", "Scorpio"), "☉ Gemini   ☽ Gemini   ↑ Scorpio");
});
test("bigThreeLabel: null ascendant -> sun + moon only", () => {
  assert.equal(bigThreeLabel("Gemini", "Gemini", null), "☉ Gemini   ☽ Gemini");
});

test("bigThreeInstantMs: range while playing freezes at the start; otherwise follows display", () => {
  assert.equal(bigThreeInstantMs("range", true, 100, 200), 100);   // playing -> start (frozen)
  assert.equal(bigThreeInstantMs("range", false, 100, 200), 200);  // paused/reset/ended -> display
  assert.equal(bigThreeInstantMs("now", true, 100, 200), 200);     // non-range -> display
  assert.equal(bigThreeInstantMs("birth", false, 100, 200), 200);
});
