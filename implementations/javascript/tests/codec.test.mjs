// StaticBin · JavaScript test suite
// Verifies identity against the golden vectors pinned in SPEC.md §8.

import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  MODE,
  decodeStream,
  eliasHeader,
  eliasWrap,
  encodeBitfield,
  encodeDynamic,
  encodeFixed,
  encodeIntegers,
  encodeSmallInts,
  encodeText,
  fromBase64Url,
  stream,
  toBase64Url,
} from "../src/staticbin.mjs";

// ─── Elias-gamma primitives ────────────────────────────────────────────────

test("elias_header pinned vectors", () => {
  assert.equal(eliasHeader(0), "0");
  assert.equal(eliasHeader(1), "1");
  assert.equal(eliasHeader(2), "010");
  assert.equal(eliasHeader(3), "011");
  assert.equal(eliasHeader(4), "00100");
  assert.equal(eliasHeader(7), "00111");
  assert.equal(eliasHeader(8), "0001000");
  assert.equal(eliasHeader(23), "000010111");
});

test("elias_wrap empty sentinel", () => {
  assert.equal(eliasWrap(""), "0");
});

// ─── Golden vectors (shared with SPEC.md §8) ───────────────────────────────

const GOLDEN = [
  ["empty",    [],                                           "A"],
  ["text_hi",  [encodeText("hi")],                           "BEhcQ0NI"],
  ["bitfield", [encodeBitfield([1, 0, 1, 1, 0])],            "Gptg"],
  ["ints",     [encodeIntegers([1, 2, 3, 4, 5])],            "DmEaZCg"],
  ["dynamic",  [encodeDynamic(["1", "010", "0001000"])],     "D8FNo4g"],
  ["compound", [encodeText("StaticBin"),
                encodeBitfield([1, 1, 0, 1])],               "A1IE8QpujC6NLGhNLcl6"],
];

for (const [name, sections, expected] of GOLDEN) {
  test(`golden encode · ${name}`, () => {
    assert.equal(toBase64Url(stream(sections)), expected);
  });

  test(`golden roundtrip · ${name}`, () => {
    const decoded = decodeStream(expected);
    assert.equal(decoded.length, sections.length);
  });
}

// ─── Schema interpretation ────────────────────────────────────────────────

test("text section roundtrip", () => {
  const code = toBase64Url(stream([encodeText("Hello, StaticBin!")]));
  const [section] = decodeStream(code);
  assert.equal(section.asText(), "Hello, StaticBin!");
});

test("bitfield section roundtrip", () => {
  const flags = [true, false, false, true, true, false, true];
  const code = toBase64Url(stream([encodeBitfield(flags)]));
  const [section] = decodeStream(code);
  assert.deepEqual(section.asBitfield(), flags);
});

test("integer section roundtrip", () => {
  const values = [1, 2, 5, 100, 32768];
  const code = toBase64Url(stream([encodeIntegers(values)]));
  const [section] = decodeStream(code);
  assert.deepEqual(section.asInts(), values);
});

test("small-ints packed and unpacked", () => {
  const values = [0, 3, 7, 15, 1];
  const code = toBase64Url(stream([encodeSmallInts(values, 4)]));
  const [section] = decodeStream(code);
  assert.equal(section.width, 4);
  assert.deepEqual(section.asInts(), values);
});

test("integer mode rejects zero", () => {
  assert.throws(() => encodeIntegers([1, 0, 3]));
});

test("fixed mode requires uniform width", () => {
  assert.throws(() => encodeFixed(["10", "110"]));
});

test("base64url rejects invalid chars", () => {
  assert.throws(() => fromBase64Url("!!!"));
});

// ─── Composite: shareable preset ──────────────────────────────────────────

test("composite preset roundtrip", () => {
  const theme = 5, font = 2, density = 1;
  const flags = [true, false, true, true];

  const code = toBase64Url(stream([
    encodeSmallInts([theme, font, density], 3),
    encodeBitfield(flags),
  ]));

  const [a, b] = decodeStream(code);
  assert.deepEqual(a.asInts(), [theme, font, density]);
  assert.deepEqual(b.asBitfield(), flags);
});