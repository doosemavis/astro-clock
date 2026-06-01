import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePassword } from "./password.ts";

test("rejects < 8 chars", () => assert.equal(validatePassword("Ab1").ok, false));
test("rejects letter-only", () => assert.equal(validatePassword("abcdefgh").ok, false));
test("rejects number-only", () => assert.equal(validatePassword("12345678").ok, false));
test("accepts 8+ with letter and number", () => {
  const r = validatePassword("abcd1234");
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
});
test("boundary: exactly 8 with letter+number passes", () =>
  assert.equal(validatePassword("abcdefg1").ok, true));
test("7 chars fails even with letter+number", () =>
  assert.equal(validatePassword("abcdef1").ok, false));
