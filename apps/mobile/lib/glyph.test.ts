import { test } from "node:test";
import assert from "node:assert/strict";
import { textGlyph, VS_TEXT_PRESENTATION } from "./glyph.ts";

test("VS_TEXT_PRESENTATION is the U+FE0E text-presentation selector", () => {
  assert.equal(VS_TEXT_PRESENTATION.codePointAt(0), 0xfe0e);
});

test("textGlyph keeps the glyph and appends U+FE0E", () => {
  const out = textGlyph("♌");
  assert.equal(out.codePointAt(0), 0x264c); // ♌ Leo, unchanged as the first codepoint
  assert.equal(out.codePointAt(1), 0xfe0e); // text-presentation selector appended
  assert.equal(out.length, 2);
});
