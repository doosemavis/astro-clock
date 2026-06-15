import { test } from "node:test";
import assert from "node:assert/strict";
import { storeUrl } from "./rateApp.ts";

test("storeUrl: android -> Play Store listing", () => {
  assert.equal(
    storeUrl("android"),
    "https://play.google.com/store/apps/details?id=com.movestar.app",
  );
});

test("storeUrl: ios -> App Store listing", () => {
  assert.match(storeUrl("ios"), /^https:\/\/apps\.apple\.com\/app\/movestar\//);
});

test("storeUrl: unknown os defaults to Play Store", () => {
  assert.equal(
    storeUrl("web"),
    "https://play.google.com/store/apps/details?id=com.movestar.app",
  );
});
