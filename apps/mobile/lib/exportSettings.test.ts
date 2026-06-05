import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_EXPORT_SETTINGS, toggleSetting, parseExportSettings } from "./exportSettings.ts";

test("defaults: all four overlays on", () => {
  assert.deepEqual(DEFAULT_EXPORT_SETTINGS, {
    caption: true, dateTime: true, placeLabel: true, cosmicBackground: true,
  });
});

test("toggleSetting flips one key immutably", () => {
  const next = toggleSetting(DEFAULT_EXPORT_SETTINGS, "placeLabel");
  assert.equal(next.placeLabel, false);
  assert.equal(DEFAULT_EXPORT_SETTINGS.placeLabel, true); // original untouched
  assert.equal(next.caption, true);
});

test("parseExportSettings falls back to defaults for missing/invalid fields", () => {
  assert.deepEqual(parseExportSettings(null), DEFAULT_EXPORT_SETTINGS);
  assert.deepEqual(parseExportSettings("nope"), DEFAULT_EXPORT_SETTINGS);
  const partial = parseExportSettings({ caption: false, placeLabel: "x" });
  assert.equal(partial.caption, false);      // valid boolean kept
  assert.equal(partial.placeLabel, true);    // invalid -> default
  assert.equal(partial.dateTime, true);      // missing -> default
});
