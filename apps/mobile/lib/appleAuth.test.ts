import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAppleIdTokenParams, appleFullNameToString, isAppleCancel } from "./appleAuth.ts";

test("buildAppleIdTokenParams: token → provider+token args", () => {
  assert.deepEqual(buildAppleIdTokenParams("tok123"), { provider: "apple", token: "tok123" });
});

test("buildAppleIdTokenParams: missing token throws", () => {
  assert.throws(() => buildAppleIdTokenParams(null), /identity token/);
});

test("appleFullNameToString: joins given + family", () => {
  assert.equal(appleFullNameToString({ givenName: "Ada", familyName: "Lovelace" }), "Ada Lovelace");
});

test("appleFullNameToString: partial name keeps the present part", () => {
  assert.equal(appleFullNameToString({ givenName: "Ada", familyName: null }), "Ada");
});

test("appleFullNameToString: absent/empty name → null", () => {
  assert.equal(appleFullNameToString(null), null);
  assert.equal(appleFullNameToString({}), null);
  assert.equal(appleFullNameToString({ givenName: "  ", familyName: null }), null);
});

test("isAppleCancel: only the cancel code is a cancel", () => {
  assert.equal(isAppleCancel({ code: "ERR_REQUEST_CANCELED" }), true);
  assert.equal(isAppleCancel(new Error("boom")), false);
  assert.equal(isAppleCancel(null), false);
});
