import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePassword } from "./password.ts";

test("validatePassword: valid password passes with no problems", () => {
  const r = validatePassword("abcd1234");
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
});

test("validatePassword: too short is flagged", () => {
  const r = validatePassword("ab12");
  assert.equal(r.ok, false);
  assert.ok(r.problems.includes("at least 8 characters"));
});

test("validatePassword: missing letter and number are each flagged", () => {
  assert.deepEqual(validatePassword("12345678").problems, ["a letter"]);
  assert.deepEqual(validatePassword("abcdefgh").problems, ["a number"]);
});

test("validatePassword: empty string reports all three problems", () => {
  assert.deepEqual(validatePassword("").problems, ["at least 8 characters", "a letter", "a number"]);
});
