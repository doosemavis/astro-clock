import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretSignUp } from "./authResult.ts";

test("interpretSignUp: empty identities + no session → already_exists", () => {
  assert.equal(
    interpretSignUp({ user: { identities: [] }, session: null }),
    "already_exists",
  );
});

test("interpretSignUp: one identity + no session → needs_confirm", () => {
  assert.equal(
    interpretSignUp({ user: { identities: [{ id: "x" }] }, session: null }),
    "needs_confirm",
  );
});

test("interpretSignUp: session present → success", () => {
  assert.equal(
    interpretSignUp({ user: { identities: [{ id: "x" }] }, session: { access_token: "t" } }),
    "success",
  );
});

test("interpretSignUp: null user + no session → needs_confirm (safe default)", () => {
  assert.equal(interpretSignUp({ user: null, session: null }), "needs_confirm");
});
