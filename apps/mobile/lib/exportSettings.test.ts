import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_EXPORT_SETTINGS, toggleSetting, parseExportSettings } from "./exportSettings.ts";

test("defaults: date, stars, logo all on", () => {
  assert.deepEqual(DEFAULT_EXPORT_SETTINGS, { dateTime: true, cosmicBackground: true, logo: true });
});

test("toggleSetting flips one key immutably", () => {
  const next = toggleSetting(DEFAULT_EXPORT_SETTINGS, "logo");
  assert.equal(next.logo, false);
  assert.equal(DEFAULT_EXPORT_SETTINGS.logo, true); // original untouched
  assert.equal(next.dateTime, true);
});

test("parseExportSettings falls back to defaults for missing/invalid fields", () => {
  assert.deepEqual(parseExportSettings(null), DEFAULT_EXPORT_SETTINGS);
  assert.deepEqual(parseExportSettings("nope"), DEFAULT_EXPORT_SETTINGS);
  const partial = parseExportSettings({ dateTime: false, logo: "x" });
  assert.equal(partial.dateTime, false);        // valid boolean kept
  assert.equal(partial.logo, true);             // invalid -> default
  assert.equal(partial.cosmicBackground, true); // missing -> default
});
