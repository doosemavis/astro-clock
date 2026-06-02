import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStars } from "./stars.ts";

test("makeStars: count + deterministic + ranges", () => {
  const a = makeStars(160, 0x5eed);
  assert.equal(a.length, 160);
  const b = makeStars(160, 0x5eed);
  assert.deepEqual(a[0], b[0]); // same seed → identical
  for (const s of a) {
    assert.ok(s.cx >= 0 && s.cx < 100 && s.cy >= 0 && s.cy < 100);
    assert.ok(s.r >= 0.04 && s.r <= 0.17);
    assert.ok(s.o >= 0.25 && s.o <= 0.95);
  }
});
test("makeStars: a different seed yields a different first star", () => {
  assert.notDeepEqual(makeStars(160, 0x5eed)[0], makeStars(160, 0x1234)[0]);
});
