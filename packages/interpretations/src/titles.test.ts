import { test } from "node:test";
import assert from "node:assert/strict";
import { titleFor } from "./titles.ts";

test("titleFor renders human titles per key family", () => {
  assert.equal(titleFor("sign:sun:Leo"), "Sun in Leo");
  assert.equal(titleFor("sign:ascendant:Leo"), "Rising in Leo");
  assert.equal(titleFor("house:sun:5"), "Sun in House 5");
  assert.equal(titleFor("transit:sun:trine:moon"), "Transiting Sun trine natal Moon");
});

test("titleFor throws on an unknown key format", () => {
  assert.throws(() => titleFor("bogus:sun:Leo"));
});
