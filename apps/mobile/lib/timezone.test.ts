import { test } from "node:test";
import assert from "node:assert/strict";
import { offsetHoursAt, zonedInstant } from "./timezone.ts";

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

test("zonedInstant: same wall-clock in different zones differs by the offset gap", () => {
  const ny = zonedInstant("2026-07-01", "15:00", "America/New_York"); // EDT = UTC-4
  const tk = zonedInstant("2026-07-01", "15:00", "Asia/Tokyo");        // JST = UTC+9
  assert.equal((ny - tk) / 3600000, 13);
});

test("zonedInstant: matches the UTC math for a fixed offset", () => {
  const ms = zonedInstant("1992-07-29", "14:28", "America/Chicago"); // CDT -5 -> 19:28 UTC
  assert.equal(new Date(ms).toISOString(), "1992-07-29T19:28:00.000Z");
});
