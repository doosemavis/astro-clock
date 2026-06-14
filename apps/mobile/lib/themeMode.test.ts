import { test } from "node:test";
import assert from "node:assert/strict";
import { themeTForMode } from "./themeMode.ts";

test("themeTForMode: light=1, dark=0", () => {
  assert.equal(themeTForMode("light", false), 1);
  assert.equal(themeTForMode("dark", true), 0);
});
test("themeTForMode: system follows the OS scheme", () => {
  assert.equal(themeTForMode("system", true), 0);  // OS dark -> night
  assert.equal(themeTForMode("system", false), 1); // OS light -> day
});
