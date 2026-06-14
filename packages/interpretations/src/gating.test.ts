import { test } from "node:test";
import assert from "node:assert/strict";
import { isTeaser, visibleField, FREE_TEASER_SUBJECTS } from "./gating.ts";

test("free teaser subjects are sun, moon, ascendant", () => {
  assert.deepEqual([...FREE_TEASER_SUBJECTS], ["sun", "moon", "ascendant"]);
});

test("isTeaser flags only the teaser subjects", () => {
  assert.equal(isTeaser("sun"), true);
  assert.equal(isTeaser("ascendant"), true);
  assert.equal(isTeaser("pluto"), false);
});

test("visibleField: free sees summary only for teaser subjects, nothing otherwise", () => {
  assert.equal(visibleField("free", "sun"), "summary");
  assert.equal(visibleField("free", "pluto"), null);
});

test("visibleField: pro sees the full body for every subject", () => {
  assert.equal(visibleField("pro", "sun"), "body");
  assert.equal(visibleField("pro", "pluto"), "body");
});
