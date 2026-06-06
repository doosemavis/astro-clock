import { test } from "node:test";
import assert from "node:assert/strict";
import { canShare, canToggleLogo, showLogo } from "./exportPolicy.ts";

test("canShare: only pro", () => {
  assert.equal(canShare("pro"), true);
  assert.equal(canShare("free"), false);
  assert.equal(canShare("anonymous"), false);
});

test("canToggleLogo: only pro", () => {
  assert.equal(canToggleLogo("pro"), true);
  assert.equal(canToggleLogo("free"), false);
  assert.equal(canToggleLogo("anonymous"), false);
});

test("showLogo: free/anon always branded; pro follows the toggle", () => {
  assert.equal(showLogo("free", false), true);
  assert.equal(showLogo("anonymous", false), true);
  assert.equal(showLogo("pro", true), true);
  assert.equal(showLogo("pro", false), false);
});
