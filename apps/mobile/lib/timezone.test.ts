import { test } from "node:test";
import assert from "node:assert/strict";
import { offsetHoursAt } from "./timezone.ts";

test("Chicago summer date is CDT (-5)", () => {
  assert.equal(offsetHoursAt("1992-07-29", "14:28", "America/Chicago"), -5);
});

test("Chicago winter date is CST (-6)", () => {
  assert.equal(offsetHoursAt("1992-01-15", "09:00", "America/Chicago"), -6);
});

test("India is +5.5 (no DST)", () => {
  assert.equal(offsetHoursAt("2000-06-01", "12:00", "Asia/Kolkata"), 5.5);
});

test("UTC is 0", () => {
  assert.equal(offsetHoursAt("2000-06-01", "12:00", "UTC"), 0);
});
