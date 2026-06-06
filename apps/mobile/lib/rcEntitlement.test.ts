import { test } from "node:test";
import assert from "node:assert/strict";
import { isProFromCustomerInfo, PRO_ENTITLEMENT } from "./rcEntitlement.ts";

test("PRO_ENTITLEMENT is 'pro'", () => {
  assert.equal(PRO_ENTITLEMENT, "pro");
});

test("null/undefined customer info → not Pro", () => {
  assert.equal(isProFromCustomerInfo(null), false);
  assert.equal(isProFromCustomerInfo(undefined), false);
});

test("active 'pro' entitlement → Pro", () => {
  const info = { entitlements: { active: { pro: { identifier: "pro" } } } };
  assert.equal(isProFromCustomerInfo(info), true);
});

test("no active entitlements → not Pro", () => {
  assert.equal(isProFromCustomerInfo({ entitlements: { active: {} } }), false);
});

test("a different active entitlement → not Pro", () => {
  const info = { entitlements: { active: { plus: { identifier: "plus" } } } };
  assert.equal(isProFromCustomerInfo(info), false);
});

test("malformed shape → not Pro (never throws)", () => {
  assert.equal(isProFromCustomerInfo({}), false);
  assert.equal(isProFromCustomerInfo({ entitlements: {} }), false);
});
