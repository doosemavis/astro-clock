import { test } from "node:test";
import assert from "node:assert/strict";
import { bigThreeLabel } from "./bigThree.ts";

test("bigThreeLabel: with ascendant shows all three", () => {
  assert.equal(bigThreeLabel("Gemini", "Gemini", "Scorpio"), "☉ Gemini   ☽ Gemini   ↑ Scorpio");
});
test("bigThreeLabel: null ascendant -> sun + moon only", () => {
  assert.equal(bigThreeLabel("Gemini", "Gemini", null), "☉ Gemini   ☽ Gemini");
});
