import { test } from "node:test";
import assert from "node:assert/strict";
import { rowToBirth, birthToRow } from "./birthCharts.ts";

const REF_ROW = {
  user_id: "u1", name: "Ref", birth_date: "1992-07-29", birth_time: "14:28:00",
  tz_offset: -6, is_dst: true, lat: 35.84, lon: -90.70, place_label: "Jonesboro, AR",
  is_primary: true,
};

test("rowToBirth maps fields + trims time to HH:MM", () => {
  const b = rowToBirth(REF_ROW);
  assert.equal(b.date, "1992-07-29");
  assert.equal(b.time, "14:28");
  assert.equal(b.tzOffset, -6);
  assert.equal(b.isDst, true);
  assert.equal(b.placeLabel, "Jonesboro, AR");
});

test("birthToRow round-trips + forces is_primary", () => {
  const row = birthToRow(rowToBirth(REF_ROW), "u1");
  assert.equal(row.birth_date, "1992-07-29");
  assert.equal(row.birth_time, "14:28");
  assert.equal(row.is_primary, true);
  assert.equal(row.place_label, "Jonesboro, AR");
});

test("null name/place become undefined", () => {
  const b = rowToBirth({ ...REF_ROW, name: null, place_label: null });
  assert.equal(b.name, undefined);
  assert.equal(b.placeLabel, undefined);
});
