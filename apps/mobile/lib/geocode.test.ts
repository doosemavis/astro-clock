import { test } from "node:test";
import assert from "node:assert/strict";
import { cityToken } from "./geocode.ts";

test("strips a trailing state/qualifier after the first comma", () => {
  // Open-Meteo only matches a bare place name, so "Jonesboro, Arkansas" must
  // become "Jonesboro" or it returns zero results.
  assert.equal(cityToken("Jonesboro, Arkansas"), "Jonesboro");
});

test("keeps a multi-word city with no comma intact", () => {
  assert.equal(cityToken("New York"), "New York");
});

test("trims surrounding whitespace around the city token", () => {
  assert.equal(cityToken("  Paris ,  France "), "Paris");
});

test("keeps accented single-name cities", () => {
  assert.equal(cityToken("São Paulo, Brazil"), "São Paulo");
});
