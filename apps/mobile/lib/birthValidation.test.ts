import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBirth } from "./birthValidation.ts";

test("valid draft builds BirthData with isDst false", () => {
  const r = validateBirth({ name: "Ada", date: "1992-07-29", time: "14:28", lat: 35.84, lon: -90.7, tzOffset: -5, placeLabel: "Jonesboro, AR" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.birth.isDst, false);
    assert.equal(r.birth.tzOffset, -5);
    assert.equal(r.birth.name, "Ada");
  }
});

test("blank name becomes undefined", () => {
  const r = validateBirth({ name: "  ", date: "1992-07-29", time: "14:28", lat: 0, lon: 0, tzOffset: 0 });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.birth.name, undefined);
});

test("missing place fails", () => {
  const r = validateBirth({ date: "1992-07-29", time: "14:28", lat: null, lon: null, tzOffset: null });
  assert.equal(r.ok, false);
});

test("out-of-range latitude fails", () => {
  const r = validateBirth({ date: "1992-07-29", time: "14:28", lat: 200, lon: 0, tzOffset: 0 });
  assert.equal(r.ok, false);
});
