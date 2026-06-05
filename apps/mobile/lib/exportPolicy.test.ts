import { test } from "node:test";
import assert from "node:assert/strict";
import { framingFor, canShare } from "./exportPolicy.ts";

test("framingFor: pro is clean; free and anon are branded", () => {
  assert.equal(framingFor("pro"), "clean");
  assert.equal(framingFor("free"), "branded");
  assert.equal(framingFor("anonymous"), "branded");
});

test("canShare: only pro can use the system share sheet", () => {
  assert.equal(canShare("pro"), true);
  assert.equal(canShare("free"), false);
  assert.equal(canShare("anonymous"), false);
});
