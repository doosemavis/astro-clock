import { test } from "node:test";
import assert from "node:assert/strict";
import { rcEventToRow } from "./rcEventToRow.ts";

const UUID = "11111111-1111-1111-1111-111111111111";
const future = Date.now() + 30 * 24 * 3600 * 1000;
const past = Date.now() - 24 * 3600 * 1000;

const base = {
  app_user_id: UUID,
  product_id: "pro_monthly",
  store: "PLAY_STORE",
  period_type: "NORMAL",
  expiration_at_ms: future,
  event_timestamp_ms: 1_700_000_000_000,
};

test("initial purchase (future expiry) → active/play", () => {
  const row = rcEventToRow({ ...base, type: "INITIAL_PURCHASE" });
  assert.equal(row?.user_id, UUID);
  assert.equal(row?.status, "active");
  assert.equal(row?.provider, "play");
  assert.equal(row?.product_id, "pro_monthly");
  assert.equal(row?.current_period_end, new Date(future).toISOString());
});

test("trial period → trialing", () => {
  const row = rcEventToRow({ ...base, type: "INITIAL_PURCHASE", period_type: "TRIAL" });
  assert.equal(row?.status, "trialing");
});

test("cancellation with future expiry stays active (access until period end)", () => {
  const row = rcEventToRow({ ...base, type: "CANCELLATION" });
  assert.equal(row?.status, "active");
});

test("expiration → expired", () => {
  const row = rcEventToRow({ ...base, type: "EXPIRATION", expiration_at_ms: past });
  assert.equal(row?.status, "expired");
});

test("refund → expired even if expiry still future", () => {
  const row = rcEventToRow({ ...base, type: "REFUND" });
  assert.equal(row?.status, "expired");
});

test("app store / stripe map to apple / stripe providers", () => {
  assert.equal(rcEventToRow({ ...base, type: "RENEWAL", store: "APP_STORE" })?.provider, "apple");
  assert.equal(rcEventToRow({ ...base, type: "RENEWAL", store: "STRIPE" })?.provider, "stripe");
});

test("non-UUID app_user_id (anonymous) → null (skip write)", () => {
  assert.equal(rcEventToRow({ ...base, type: "INITIAL_PURCHASE", app_user_id: "$RCAnonymousID:abc" }), null);
});

test("missing app_user_id → null", () => {
  assert.equal(rcEventToRow({ ...base, type: "INITIAL_PURCHASE", app_user_id: undefined }), null);
});
