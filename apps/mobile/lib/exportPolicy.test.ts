import { test } from "node:test";
import assert from "node:assert/strict";
import { canShare, canSave } from "./exportPolicy.ts";

test("canShare: only pro", () => {
  assert.equal(canShare("pro"), true);
  assert.equal(canShare("free"), false);
  assert.equal(canShare("anonymous"), false);
});

test("canSave: requires an account (free/pro), not anonymous", () => {
  assert.equal(canSave("anonymous"), false);
  assert.equal(canSave("free"), true);
  assert.equal(canSave("pro"), true);
});
