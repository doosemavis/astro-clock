import { test } from "node:test";
import assert from "node:assert/strict";
import * as api from "./index.ts";

test("public surface exports the expected functions and schemas", () => {
  const fns = [
    "signKey", "houseKey", "transitKey",
    "allSignKeys", "allHouseKeys", "allTransitKeys",
    "lookup", "visibleField", "isTeaser",
    "transitHits", "natalRequests", "forecastRequests",
  ];
  for (const name of fns) {
    assert.equal(typeof (api as Record<string, unknown>)[name], "function", `missing ${name}`);
  }
  assert.ok(api.InterpretationSchema, "missing InterpretationSchema");
  assert.ok(api.BankSchema, "missing BankSchema");
});
