import { test } from "node:test";
import assert from "node:assert/strict";
import { entitlementFromRow, tierOf } from "./entitlement.ts";

test("entitlementFromRow: null row → not Pro", () => {
  assert.equal(entitlementFromRow(null).isPro, false);
});

test("entitlementFromRow: active with a future period end → Pro", () => {
  assert.equal(entitlementFromRow({ status: "active", current_period_end: "2999-01-01T00:00:00Z" }).isPro, true);
});

test("entitlementFromRow: trialing with a future period end → Pro", () => {
  assert.equal(entitlementFromRow({ status: "trialing", current_period_end: "2999-01-01T00:00:00Z" }).isPro, true);
});

test("entitlementFromRow: active but expired → not Pro", () => {
  assert.equal(entitlementFromRow({ status: "active", current_period_end: "2000-01-01T00:00:00Z" }).isPro, false);
});

test("entitlementFromRow: canceled (future end) → not Pro", () => {
  assert.equal(entitlementFromRow({ status: "canceled", current_period_end: "2999-01-01T00:00:00Z" }).isPro, false);
});

test("entitlementFromRow: active but null period end → not Pro", () => {
  assert.equal(entitlementFromRow({ status: "active", current_period_end: null }).isPro, false);
});

test("tierOf: signed out → anonymous (even if isPro somehow true)", () => {
  assert.equal(tierOf(false, false), "anonymous");
  assert.equal(tierOf(false, true), "anonymous");
});

test("tierOf: signed in maps to free / pro", () => {
  assert.equal(tierOf(true, false), "free");
  assert.equal(tierOf(true, true), "pro");
});
