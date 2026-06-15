import { test } from "node:test";
import assert from "node:assert/strict";
import { themeTForMode, parseThemeMode } from "./themeMode.ts";

test("themeTForMode: light=1, dark=0", () => {
  assert.equal(themeTForMode("light", false), 1);
  assert.equal(themeTForMode("dark", true), 0);
});
test("themeTForMode: system follows the OS scheme", () => {
  assert.equal(themeTForMode("system", true), 0);  // OS dark -> night
  assert.equal(themeTForMode("system", false), 1); // OS light -> day
});

test("parseThemeMode: valid values pass through", () => {
  assert.equal(parseThemeMode("light"), "light");
  assert.equal(parseThemeMode("dark"), "dark");
  assert.equal(parseThemeMode("system"), "system");
});
test("parseThemeMode: null/garbage -> default system", () => {
  assert.equal(parseThemeMode(null), "system");
  assert.equal(parseThemeMode("auto"), "system");  // legacy/invalid
  assert.equal(parseThemeMode("xyz"), "system");
});
