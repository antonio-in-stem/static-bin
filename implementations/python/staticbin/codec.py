"""StaticBin codec. Reference implementation.

The codec operates exclusively on bit-strings (`str` of `"0"` and `"1"`).
All schema interpretation (what an 8-bit chunk means, whether a 1-bit
chunk is a flag, etc.) lives in the caller.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Iterable, Sequence

# ---------------------------------------------------------------------------
# Alphabet
# ---------------------------------------------------------------------------

_B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
_B64_LOOKUP   = {c: i for i, c in enumerate(_B64_ALPHABET)}


# ---------------------------------------------------------------------------
# Bit-level primitives (Elias-gamma)
# ---------------------------------------------------------------------------


def elias_header(n: int) -> str:
    """Return header(n); see SPEC §3.1 and §3.2."""
    if n < 0:
        raise ValueError("Elias-gamma is defined for non-negative integers only")
    if n == 0:
        return "0"
    binary = format(n, "b")
    return "0" * (len(binary) - 1) + binary


def elias_wrap(payload: str) -> str:
    """Return wrap(payload) per SPEC §3.3."""
    if not payload:
        return "0"
    return elias_header(len(payload)) + payload


class BitReader:
    """Cursor over a bit-string with unwrap/peek helpers."""

    __slots__ = ("_bits", "_pos", "_end")

    def __init__(self, bits: str) -> None:
        self._bits = bits
        self._pos  = 0
        self._end  = len(bits)

    def read(self, n: int) -> str:
        if self._pos + n > self._end:
            raise ValueError("Unexpected end of stream")
        chunk = self._bits[self._pos : self._pos + n]
        self._pos += n
        return chunk

    def peek(self, n: int) -> str:
        if self._pos + n > self._end:
            return ""
        return self._bits[self._pos : self._pos + n]

    def read_rest(self) -> str:
        chunk = self._bits[self._pos :]
        self._pos = self._end
        return chunk

    def eof(self) -> bool:
        return self._pos >= self._end

    def decode_header(self) -> int:
        zeros = 0
        while self.peek(1) == "0":
            self.read(1)
            zeros += 1
        if self.eof():
            # Sentinel: only zeros remain (empty-payload marker plus any
            # trailing base64 padding). Interpreted as N = 0 per SPEC §3.2.
            return 0
        return int(self.read(zeros + 1), 2)

    def unwrap(self) -> str:
        return self.read(self.decode_header())


# ---------------------------------------------------------------------------
# Section encoders
# ---------------------------------------------------------------------------


class Mode(str, Enum):
    FIXED   = "01"
    DYNAMIC = "10"
    INTEGER = "11"


def _assert_binary(chunk: str) -> None:
    if not chunk or not set(chunk).issubset({"0", "1"}):
        raise ValueError(f"Chunk is not a non-empty bit-string: {chunk!r}")


def encode_fixed(chunks: Sequence[str]) -> str:
    """FIXED mode (tag 01). All chunks must have identical width."""
    if not chunks:
        return Mode.FIXED.value + elias_wrap("")
    width = len(chunks[0])
    for c in chunks:
        _assert_binary(c)
        if len(c) != width:
            raise ValueError(f"FIXED mode requires uniform width; saw {width} and {len(c)}")
    payload = elias_header(width) + "".join(chunks)
    return Mode.FIXED.value + elias_wrap(payload)


def encode_dynamic(chunks: Sequence[str]) -> str:
    """DYNAMIC mode (tag 10). Chunks may have any positive width."""
    for c in chunks:
        _assert_binary(c)
    payload = "".join(elias_wrap(c) for c in chunks)
    return Mode.DYNAMIC.value + elias_wrap(payload)


def encode_integers(values: Iterable[int]) -> str:
    """INTEGER mode (tag 11). Values must be >= 1."""
    values = list(values)
    for v in values:
        if not isinstance(v, int) or v < 1:
            raise ValueError(f"INTEGER mode requires positive integers; got {v!r}")
    payload = "".join(elias_header(v) for v in values)
    return Mode.INTEGER.value + elias_wrap(payload)


# ---------------------------------------------------------------------------
# Convenience recipes
# ---------------------------------------------------------------------------


def encode_text(text: str, *, encoding: str = "utf-8") -> str:
    """Text as a FIXED section of 8-bit chunks.

    Any bytes-compatible encoding works; the schema on both ends must agree.
    """
    raw = text.encode(encoding)
    chunks = [format(b, "08b") for b in raw]
    return encode_fixed(chunks)


def encode_bitfield(flags: Sequence[bool | int]) -> str:
    """Flags as a FIXED section of 1-bit chunks."""
    chunks = ["1" if bool(f) else "0" for f in flags]
    return encode_fixed(chunks)


def encode_small_ints(values: Sequence[int], *, width: int) -> str:
    """Non-negative integers packed at a given fixed bit width."""
    ceiling = (1 << width) - 1
    chunks: list[str] = []
    for v in values:
        if v < 0 or v > ceiling:
            raise ValueError(f"Value {v} does not fit in {width} bits")
        chunks.append(format(v, f"0{width}b"))
    return encode_fixed(chunks)


# ---------------------------------------------------------------------------
# Stream <-> base64url
# ---------------------------------------------------------------------------


def stream(sections: Sequence[str]) -> str:
    """Concatenate sections and apply the global wrap."""
    return elias_wrap("".join(sections))


def to_base64url(bits: str) -> str:
    """Right-pad to a multiple of 6 bits and encode as URL-safe base64."""
    remainder = len(bits) % 6
    if remainder:
        bits = bits + "0" * (6 - remainder)
    return "".join(
        _B64_ALPHABET[int(bits[i : i + 6], 2)] for i in range(0, len(bits), 6)
    )


def from_base64url(s: str) -> str:
    """Decode base64url text to a bit-string, ignoring whitespace."""
    out: list[str] = []
    for ch in s:
        if ch.isspace():
            continue
        if ch not in _B64_LOOKUP:
            raise ValueError(f"Invalid base64url character: {ch!r}")
        out.append(format(_B64_LOOKUP[ch], "06b"))
    return "".join(out)


# ---------------------------------------------------------------------------
# Decoder
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Section:
    """One decoded section, prior to schema interpretation."""
    mode:   Mode
    chunks: tuple[str | int, ...]
    width:  int | None = None     # only for FIXED mode

    # Ergonomic re-hydration helpers

    def as_text(self, *, encoding: str = "utf-8") -> str:
        if self.mode is not Mode.FIXED or self.width != 8:
            raise ValueError("Section is not an 8-bit FIXED section")
        raw = bytes(int(c, 2) for c in self.chunks)
        return raw.decode(encoding)

    def as_bitfield(self) -> tuple[bool, ...]:
        if self.mode is not Mode.FIXED or self.width != 1:
            raise ValueError("Section is not a 1-bit FIXED section")
        return tuple(c == "1" for c in self.chunks)

    def as_ints(self, *, offset: int = 0) -> tuple[int, ...]:
        if self.mode is Mode.INTEGER:
            return tuple(int(c) - offset for c in self.chunks)
        if self.mode is Mode.FIXED:
            return tuple(int(c, 2) - offset for c in self.chunks)
        raise ValueError("Section does not carry integers")


def decode_stream(bits_or_b64: str) -> list[Section]:
    """Decode a StaticBin stream. Accepts raw bits or base64url."""
    bits = (
        bits_or_b64
        if set(bits_or_b64.strip()).issubset({"0", "1"}) and bits_or_b64
        else from_base64url(bits_or_b64)
    )
    outer = BitReader(bits)
    payload = outer.unwrap()

    reader = BitReader(payload)
    out: list[Section] = []

    while not reader.eof():
        tag = reader.read(2)
        if tag == Mode.FIXED.value:
            body      = reader.unwrap()
            br        = BitReader(body)
            width     = br.decode_header()
            remaining = br.read_rest()
            chunks: list[str | int] = []
            if width > 0:
                for i in range(0, len(remaining), width):
                    c = remaining[i : i + width]
                    if len(c) == width:
                        chunks.append(c)
            out.append(Section(Mode.FIXED, tuple(chunks), width=width))

        elif tag == Mode.DYNAMIC.value:
            body = reader.unwrap()
            br   = BitReader(body)
            chunks_d: list[str | int] = []
            while not br.eof():
                chunks_d.append(br.unwrap())
            out.append(Section(Mode.DYNAMIC, tuple(chunks_d)))

        elif tag == Mode.INTEGER.value:
            body = reader.unwrap()
            br   = BitReader(body)
            ints: list[str | int] = []
            while not br.eof():
                ints.append(br.decode_header())
            out.append(Section(Mode.INTEGER, tuple(ints)))

        else:
            raise ValueError(f"Unknown mode tag: {tag!r}")

    return out
