import { test } from "node:test";
import assert from "node:assert/strict";
import { mixPalette, mixColor, NIGHT, DAY } from "./theme.ts";

test("mixPalette(0) equals the NIGHT endpoints (as rgb)", () => {
  assert.equal(mixPalette(0).bg, mixColor(NIGHT.bg, DAY.bg, 0));
  assert.equal(mixPalette(0).live, mixColor(NIGHT.live, DAY.live, 0));
});
test("mixPalette(1) equals the DAY endpoints (as rgb)", () => {
  assert.equal(mixPalette(1).live, mixColor(NIGHT.live, DAY.live, 1));
});
test("mixPalette has all 11 palette keys", () => {
  assert.equal(Object.keys(mixPalette(0.5)).length, 11);
});
test("mixPalette clamps out-of-range t", () => {
  assert.equal(mixPalette(-1).bg, mixPalette(0).bg);
  assert.equal(mixPalette(2).bg, mixPalette(1).bg);
});
