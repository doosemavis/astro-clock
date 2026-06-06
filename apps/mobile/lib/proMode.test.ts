import { test } from "node:test";
import assert from "node:assert/strict";
import { PRO_MODES, isProMode, clampMode } from "./proMode.ts";

test("PRO_MODES are exactly moment, range, compare", () => {
  assert.deepEqual([...PRO_MODES].sort(), ["compare", "moment", "range"]);
});

test("isProMode flags only the pro modes", () => {
  assert.equal(isProMode("moment"), true);
  assert.equal(isProMode("range"), true);
  assert.equal(isProMode("compare"), true);
  assert.equal(isProMode("birth"), false);
  assert.equal(isProMode("now"), false);
});

test("clampMode: Pro user keeps any mode", () => {
  assert.equal(clampMode("compare", true), "compare");
  assert.equal(clampMode("birth", true), "birth");
});

test("clampMode: non-Pro in a Pro mode snaps to birth", () => {
  assert.equal(clampMode("moment", false), "birth");
  assert.equal(clampMode("range", false), "birth");
  assert.equal(clampMode("compare", false), "birth");
});

test("clampMode: non-Pro in an allowed mode is unchanged", () => {
  assert.equal(clampMode("birth", false), "birth");
  assert.equal(clampMode("now", false), "now");
});
