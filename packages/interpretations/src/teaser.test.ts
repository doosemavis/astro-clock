import { test } from "node:test";
import assert from "node:assert/strict";
import { TEASER_BANK, TeaserBankSchema } from "./teaser.ts";
import { signKey } from "./keys.ts";
import { SIGNS } from "@astro/engine";

test("teaser bank validates against the schema", () => {
  assert.doesNotThrow(() => TeaserBankSchema.parse(TEASER_BANK));
});

test("teaser bank covers sun/moon/ascendant × 12 signs (36) with non-empty summaries", () => {
  for (const subj of ["sun", "moon", "ascendant"] as const) {
    for (const sign of SIGNS) {
      const entry = TEASER_BANK[signKey(subj, sign)];
      assert.ok(entry, `missing ${subj} ${sign}`);
      assert.ok(entry.summary.trim().length > 0, `empty summary ${subj} ${sign}`);
    }
  }
  assert.equal(Object.keys(TEASER_BANK).length, 36);
});
