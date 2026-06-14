import { test } from "node:test";
import assert from "node:assert/strict";
import { InterpretationSchema, BankSchema } from "./schema.ts";

const valid = {
  key: "sign:sun:Leo",
  title: "Sun in Leo",
  summary: "Warm, proud, and expressive.",
  body: "A fuller paragraph of interpretation text.",
  keywords: ["pride", "warmth"],
  meta: { model: "test-model", generatedAt: "2026-06-09T00:00:00Z", reviewed: true, v: 1 },
};

test("InterpretationSchema accepts a valid entry", () => {
  assert.doesNotThrow(() => InterpretationSchema.parse(valid));
});

test("InterpretationSchema rejects empty body", () => {
  assert.throws(() => InterpretationSchema.parse({ ...valid, body: "" }));
});

test("InterpretationSchema rejects a non-boolean reviewed flag", () => {
  assert.throws(() => InterpretationSchema.parse({ ...valid, meta: { ...valid.meta, reviewed: "yes" } }));
});

test("BankSchema accepts a keyed map of entries", () => {
  assert.doesNotThrow(() => BankSchema.parse({ [valid.key]: valid }));
});

test("BankSchema rejects an entry with an invalid field", () => {
  assert.throws(() => BankSchema.parse({ [valid.key]: { ...valid, body: "" } }));
});
