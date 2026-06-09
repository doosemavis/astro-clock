import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReadingRows } from "./readingRows.ts";
import { PLANET_KEYS, type Positions } from "@astro/engine";

const zero = (): Positions => Object.fromEntries(PLANET_KEYS.map((k) => [k, 0])) as Positions;

test("buildReadingRows: rising + sun + moon are teasers with summary text", () => {
  const rows = buildReadingRows(zero(), 0, false);
  const rising = rows.find((r) => r.key === "sign:ascendant:Aries");
  const sun = rows.find((r) => r.key === "sign:sun:Aries");
  const moon = rows.find((r) => r.key === "sign:moon:Aries");
  for (const r of [rising, sun, moon]) {
    assert.ok(r, "row missing");
    assert.equal(r!.state, "teaser");
    assert.ok((r!.summary ?? "").length > 0, "teaser summary should be non-empty");
  }
});

test("buildReadingRows: non-teaser planet is locked for free, comingSoon for pro", () => {
  const free = buildReadingRows(zero(), 0, false).find((r) => r.key === "sign:venus:Aries");
  const pro = buildReadingRows(zero(), 0, true).find((r) => r.key === "sign:venus:Aries");
  assert.equal(free!.state, "locked");
  assert.equal(pro!.state, "comingSoon");
});

test("buildReadingRows: only sign rows (rising + 10 planets = 11)", () => {
  assert.equal(buildReadingRows(zero(), 0, false).length, 11);
});
