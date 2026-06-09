import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANET_KEYS } from "@astro/engine";

test("smoke: @astro/engine resolves from @astro/interpretations", () => {
  assert.equal(PLANET_KEYS.length, 10);
});
