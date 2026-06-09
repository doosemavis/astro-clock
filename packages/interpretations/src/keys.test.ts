import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signKey, houseKey, transitKey,
  allSignKeys, allHouseKeys, allTransitKeys,
  TRANSITING_BODIES, TRANSIT_ASPECTS,
} from "./keys.ts";

test("key builders produce deterministic ids", () => {
  assert.equal(signKey("sun", "Leo"), "sign:sun:Leo");
  assert.equal(signKey("ascendant", "Leo"), "sign:ascendant:Leo");
  assert.equal(houseKey("sun", 5), "house:sun:5");
  assert.equal(transitKey("sun", "trine", "moon"), "transit:sun:trine:moon");
});

test("enumerations have the expected counts (v1 scope)", () => {
  // 11 subjects (10 planets + ascendant) x 12 signs
  assert.equal(allSignKeys().length, 11 * 12);
  // 10 planets x 12 houses (ascendant defines house 1, has no house entry)
  assert.equal(allHouseKeys().length, 10 * 12);
  // 5 transiting bodies x 5 major aspects x 10 natal bodies
  assert.equal(allTransitKeys().length, TRANSITING_BODIES.length * TRANSIT_ASPECTS.length * 10);
  assert.equal(TRANSITING_BODIES.length, 5);
  assert.equal(TRANSIT_ASPECTS.length, 5);
});

test("enumerations are unique (no duplicate keys)", () => {
  const all = [...allSignKeys(), ...allHouseKeys(), ...allTransitKeys()];
  assert.equal(new Set(all).size, all.length);
});
