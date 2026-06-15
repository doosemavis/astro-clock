import { test } from "node:test";
import assert from "node:assert/strict";
import { SLIDES, parseOnboardingSeen, SEEN_VALUE } from "./onboarding.ts";

test("parseOnboardingSeen: only the exact seen value is true", () => {
  assert.equal(parseOnboardingSeen(SEEN_VALUE), true);
  assert.equal(parseOnboardingSeen(null), false);
  assert.equal(parseOnboardingSeen("0"), false);
  assert.equal(parseOnboardingSeen("true"), false);
});

test("SLIDES: exactly 5 slides", () => {
  assert.equal(SLIDES.length, 5);
});

test("SLIDES: first and last slides offer create-account (bookended funnel)", () => {
  const hasCreate = (s: (typeof SLIDES)[number]) =>
    s.primary.action === "createAccount" || s.secondary?.action === "createAccount";
  assert.equal(hasCreate(SLIDES[0]), true);
  assert.equal(hasCreate(SLIDES[SLIDES.length - 1]), true);
});

test("SLIDES: every slide has content + a valid demo kind", () => {
  const kinds = new Set(["live", "natal", "timetravel"]);
  for (const s of SLIDES) {
    assert.ok(s.title.length > 0, `${s.id} title`);
    assert.ok(s.body.length > 0, `${s.id} body`);
    assert.ok(kinds.has(s.demo), `${s.id} demo`);
    assert.ok(s.primary.label.length > 0, `${s.id} primary`);
  }
});
