import { test } from "node:test";
import assert from "node:assert/strict";
import { lookup } from "./lookup.ts";
import type { Bank } from "./types.ts";

const bank: Bank = {
  "sign:sun:Leo": {
    key: "sign:sun:Leo", title: "Sun in Leo", summary: "s", body: "b",
    meta: { model: "m", generatedAt: "2026-06-09T00:00:00Z", reviewed: true, v: 1 },
  },
};

test("lookup returns the entry for a known key", () => {
  assert.equal(lookup(bank, "sign:sun:Leo")?.title, "Sun in Leo");
});

test("lookup returns null for an unknown key", () => {
  assert.equal(lookup(bank, "sign:moon:Aries"), null);
});
