import { test } from "node:test";
import assert from "node:assert/strict";
import { generateBank, titleFor, promptFor } from "../scripts/generate.ts";
import { allSignKeys, allHouseKeys, allTransitKeys } from "./keys.ts";
import { BankSchema } from "./schema.ts";

test("titleFor renders human titles per key family", () => {
  assert.equal(titleFor("sign:sun:Leo"), "Sun in Leo");
  assert.equal(titleFor("sign:ascendant:Leo"), "Rising in Leo");
  assert.equal(titleFor("house:sun:5"), "Sun in House 5");
  assert.equal(titleFor("transit:sun:trine:moon"), "Transiting Sun trine natal Moon");
});

test("promptFor mentions the rendered title", () => {
  assert.ok(promptFor("sign:sun:Leo").includes("Sun in Leo"));
});

test("generateBank covers every v1 key and produces a schema-valid bank", async () => {
  const complete = async ({ key }: { key: string }) => ({ summary: `s:${key}`, body: `b:${key}` });
  const bank = await generateBank({ complete, model: "test-model", now: "2026-06-09T00:00:00Z" });
  const expected = [...allSignKeys(), ...allHouseKeys(), ...allTransitKeys()];
  assert.equal(Object.keys(bank).length, expected.length);
  for (const k of expected) assert.ok(bank[k], `missing ${k}`);
  assert.doesNotThrow(() => BankSchema.parse(bank));
});
