/**
 * StaticBin · TypeScript port of the reference codec.
 *
 * Spec: implementations/python/staticbin/codec.py (bit-for-bit compatible).
 * This module is pure, dependency-free, and runs in any modern runtime.
 */

export type Mode = "01" | "10" | "11";

export const MODE = {
  FIXED: "01",
  DYNAMIC: "10",
  INTEGER: "11",
} as const satisfies Record<string, Mode>;

const B64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const B64_LOOKUP: Record<string, number> = Object.fromEntries(
  [...B64_ALPHABET].map((c, i) => [c, i] as const),
);

// ─── Elias-gamma ──────────────────────────────────────────────────────

export function eliasHeader(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError("Elias-gamma is defined for non-negative integers");
  }
  if (n === 0) return "0";
  const binary = n.toString(2);
  return "0".repeat(binary.length - 1) + binary;
}

export function eliasWrap(payload: string): string {
  if (!payload) return "0";
  return eliasHeader(payload.length) + payload;
}

export class BitReader {
  private bits: string;
  private pos = 0;
  private readonly end: number;

  constructor(bits: string) {
    this.bits = bits;
    this.end = bits.length;
  }

  read(n: number): string {
    if (this.pos + n > this.end) throw new RangeError("Unexpected end of stream");
    const chunk = this.bits.slice(this.pos, this.pos + n);
    this.pos += n;
    return chunk;
  }

  peek(n: number): string {
    if (this.pos + n > this.end) return "";
    return this.bits.slice(this.pos, this.pos + n);
  }

  readRest(): string {
    const chunk = this.bits.slice(this.pos);
    this.pos = this.end;
    return chunk;
  }

  eof(): boolean {
    return this.pos >= this.end;
  }

  decodeHeader(): number {
    let zeros = 0;
    while (this.peek(1) === "0") {
      this.read(1);
      zeros += 1;
    }
    if (this.eof()) return 0;
    return parseInt(this.read(zeros + 1), 2);
  }

  unwrap(): string {
    return this.read(this.decodeHeader());
  }
}

// ─── Section encoders ─────────────────────────────────────────────────

function assertBinary(chunk: unknown): asserts chunk is string {
  if (typeof chunk !== "string" || !/^[01]+$/.test(chunk)) {
    throw new TypeError(`Chunk is not a non-empty bit-string: ${JSON.stringify(chunk)}`);
  }
}

export function encodeFixed(chunks: string[]): string {
  if (chunks.length === 0) return MODE.FIXED + eliasWrap("");
  const width = chunks[0]!.length;
  for (const c of chunks) {
    assertBinary(c);
    if (c.length !== width) {
      throw new RangeError(`FIXED mode requires uniform width; saw ${width} and ${c.length}`);
    }
  }
  return MODE.FIXED + eliasWrap(eliasHeader(width) + chunks.join(""));
}

export function encodeDynamic(chunks: string[]): string {
  for (const c of chunks) assertBinary(c);
  const payload = chunks.map(eliasWrap).join("");
  return MODE.DYNAMIC + eliasWrap(payload);
}

export function encodeIntegers(values: number[]): string {
  for (const v of values) {
    if (!Number.isInteger(v) || v < 1) {
      throw new RangeError(`INTEGER mode requires positive integers; got ${v}`);
    }
  }
  return MODE.INTEGER + eliasWrap(values.map(eliasHeader).join(""));
}

// ─── Recipes ──────────────────────────────────────────────────────────

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export function encodeText(text: string): string {
  const bytes = TEXT_ENCODER.encode(text);
  const chunks = [...bytes].map((b) => b.toString(2).padStart(8, "0"));
  return encodeFixed(chunks);
}

export function encodeBitfield(flags: boolean[]): string {
  return encodeFixed(flags.map((f) => (f ? "1" : "0")));
}

export function encodeSmallInts(values: number[], width: number): string {
  const ceiling = (1 << width) - 1;
  const chunks = values.map((v) => {
    if (v < 0 || v > ceiling) {
      throw new RangeError(`Value ${v} does not fit in ${width} bits`);
    }
    return v.toString(2).padStart(width, "0");
  });
  return encodeFixed(chunks);
}

// ─── Stream ⇄ base64url ───────────────────────────────────────────────

export function stream(sections: string[]): string {
  return eliasWrap(sections.join(""));
}

export function toBase64Url(bits: string): string {
  const remainder = bits.length % 6;
  if (remainder) bits = bits + "0".repeat(6 - remainder);
  let out = "";
  for (let i = 0; i < bits.length; i += 6) {
    out += B64_ALPHABET[parseInt(bits.slice(i, i + 6), 2)];
  }
  return out;
}

export function fromBase64Url(s: string): string {
  let out = "";
  for (const ch of s) {
    if (/\s/.test(ch)) continue;
    if (!(ch in B64_LOOKUP)) {
      throw new TypeError(`Invalid base64url character: ${JSON.stringify(ch)}`);
    }
    out += B64_LOOKUP[ch]!.toString(2).padStart(6, "0");
  }
  return out;
}

// ─── Decoder ──────────────────────────────────────────────────────────

export class Section {
  readonly mode: Mode;
  readonly chunks: readonly (string | number)[];
  readonly width: number | null;

  constructor(mode: Mode, chunks: (string | number)[], width: number | null = null) {
    this.mode = mode;
    this.chunks = Object.freeze(chunks.slice());
    this.width = width;
  }

  asText(): string {
    if (this.mode !== MODE.FIXED || this.width !== 8) {
      throw new TypeError("Section is not an 8-bit FIXED section");
    }
    const bytes = new Uint8Array((this.chunks as string[]).map((c) => parseInt(c, 2)));
    return TEXT_DECODER.decode(bytes);
  }

  asBitfield(): boolean[] {
    if (this.mode !== MODE.FIXED || this.width !== 1) {
      throw new TypeError("Section is not a 1-bit FIXED section");
    }
    return (this.chunks as string[]).map((c) => c === "1");
  }

  asInts(opts: { offset?: number } = {}): number[] {
    const { offset = 0 } = opts;
    if (this.mode === MODE.INTEGER) return (this.chunks as number[]).map((n) => n - offset);
    if (this.mode === MODE.FIXED) {
      return (this.chunks as string[]).map((c) => parseInt(c, 2) - offset);
    }
    throw new TypeError("Section does not carry integers");
  }
}

export function decodeStream(input: string): Section[] {
  const looksBinary = input && /^[01\s]+$/.test(input);
  const bits = looksBinary ? input.replace(/\s+/g, "") : fromBase64Url(input);

  const outer = new BitReader(bits);
  const payload = outer.unwrap();
  const reader = new BitReader(payload);
  const out: Section[] = [];

  while (!reader.eof()) {
    const tag = reader.read(2) as Mode;
    if (tag === MODE.FIXED) {
      const body = reader.unwrap();
      const br = new BitReader(body);
      const width = br.decodeHeader();
      const remaining = br.readRest();
      const chunks: string[] = [];
      if (width > 0) {
        for (let i = 0; i + width <= remaining.length; i += width) {
          chunks.push(remaining.slice(i, i + width));
        }
      }
      out.push(new Section(MODE.FIXED, chunks, width));
    } else if (tag === MODE.DYNAMIC) {
      const body = reader.unwrap();
      const br = new BitReader(body);
      const chunks: string[] = [];
      while (!br.eof()) chunks.push(br.unwrap());
      out.push(new Section(MODE.DYNAMIC, chunks));
    } else if (tag === MODE.INTEGER) {
      const body = reader.unwrap();
      const br = new BitReader(body);
      const ints: number[] = [];
      while (!br.eof()) ints.push(br.decodeHeader());
      out.push(new Section(MODE.INTEGER, ints));
    } else {
      throw new TypeError(`Unknown mode tag: ${tag}`);
    }
  }
  return out;
}
