import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveDate, PACES, actualOffset, HR, DY, pageIndex } from "./chartModel.ts";
import type { BirthData } from "@astro/engine";

const BIRTH: BirthData = {
  name: "Test", date: "1992-07-29", time: "14:28",
  tzOffset: -6, isDst: true, lat: 35.84, lon: -90.7, placeLabel: "Jonesboro",
};

test("resolveDate: birth and moment return their exact instants", () => {
  assert.equal(resolveDate("birth", 1000, 2000, 3000, 9000, 0.5).getTime(), 1000);
  assert.equal(resolveDate("moment", 1000, 2000, 3000, 9000, 0.5).getTime(), 2000);
});

test("resolveDate: range interpolates linearly by pos", () => {
  assert.equal(resolveDate("range", 0, 0, 1000, 3000, 0).getTime(), 1000);
  assert.equal(resolveDate("range", 0, 0, 1000, 3000, 0.5).getTime(), 2000);
  assert.equal(resolveDate("range", 0, 0, 1000, 3000, 1).getTime(), 3000);
});

test("resolveDate: now is the current instant", () => {
  const before = Date.now();
  const got = resolveDate("now", 0, 0, 0, 0, 0).getTime();
  assert.ok(got >= before && got <= Date.now() + 1000);
});

test("PACES: 6 speeds spanning 1 hour/sec to 1 month/sec", () => {
  assert.equal(PACES.length, 6);
  assert.equal(PACES[0].rate, HR);
  assert.equal(PACES[5].rate, 30 * DY);
});

test("actualOffset: adds the DST hour when isDst", () => {
  assert.equal(actualOffset(BIRTH), -5);
  assert.equal(actualOffset({ ...BIRTH, isDst: false }), -6);
});

test("pageIndex: offset 0 → page 0", () => {
  assert.equal(pageIndex(0, 390, 2), 0);
});
test("pageIndex: just under half a page stays on page 0", () => {
  assert.equal(pageIndex(194, 390, 2), 0);
});
test("pageIndex: at half a page rounds to the next page", () => {
  assert.equal(pageIndex(195, 390, 2), 1);
});
test("pageIndex: a full page width → page 1", () => {
  assert.equal(pageIndex(390, 390, 2), 1);
});
test("pageIndex: overscroll clamps to the last page", () => {
  assert.equal(pageIndex(900, 390, 2), 1);
});
test("pageIndex: negative overscroll clamps to 0", () => {
  assert.equal(pageIndex(-50, 390, 2), 0);
});
test("pageIndex: a zero page width is safe (→ 0)", () => {
  assert.equal(pageIndex(100, 0, 2), 0);
});
