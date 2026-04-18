"""Test suite for StaticBin Python reference.

Cross-implementation golden vectors are defined in `TEST_VECTORS`.
Every port (JS, C99, Fortran) is expected to produce identical outputs.
"""

from __future__ import annotations

import pytest

from staticbin import (
    Mode,
    Section,
    decode_stream,
    encode_bitfield,
    encode_dynamic,
    encode_fixed,
    encode_integers,
    encode_small_ints,
    encode_text,
    from_base64url,
    stream,
    to_base64url,
)
from staticbin.codec import BitReader, elias_header, elias_wrap


# ---------------------------------------------------------------------------
# Elias-gamma primitives
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "n,expected",
    [
        (0, "0"),
        (1, "1"),
        (2, "010"),
        (3, "011"),
        (4, "00100"),
        (7, "00111"),
        (8, "0001000"),
        (23, "000010111"),
    ],
)
def test_elias_header(n: int, expected: str) -> None:
    assert elias_header(n) == expected


def test_elias_wrap_empty() -> None:
    assert elias_wrap("") == "0"


def test_elias_wrap_roundtrip() -> None:
    payload = "1011010"
    wrapped = elias_wrap(payload)
    reader  = BitReader(wrapped)
    assert reader.unwrap() == payload


# ---------------------------------------------------------------------------
# Golden test vectors (shared across language ports)
# ---------------------------------------------------------------------------

TEST_VECTORS = [
    ("empty",    [],                                                 "A"),
    ("text_hi",  [encode_text("hi")],                                "BEhcQ0NI"),
    ("bitfield", [encode_bitfield([1, 0, 1, 1, 0])],                 "Gptg"),
    ("ints",     [encode_integers([1, 2, 3, 4, 5])],                 "DmEaZCg"),
    ("dynamic",  [encode_dynamic(["1", "010", "0001000"])],          "D8FNo4g"),
    ("compound", [encode_text("StaticBin"),
                  encode_bitfield([1, 1, 0, 1])],                    "A1IE8QpujC6NLGhNLcl6"),
]


@pytest.mark.parametrize("name,sections,expected", TEST_VECTORS, ids=lambda v: v if isinstance(v, str) else "")
def test_golden_encode(name: str, sections: list[str], expected: str) -> None:
    assert to_base64url(stream(sections)) == expected


@pytest.mark.parametrize("name,sections,expected", TEST_VECTORS, ids=lambda v: v if isinstance(v, str) else "")
def test_golden_roundtrip(name: str, sections: list[str], expected: str) -> None:
    decoded = decode_stream(expected)
    if not sections:
        assert decoded == []
    else:
        assert len(decoded) == len(sections)


# ---------------------------------------------------------------------------
# Schema interpretation (Section helpers)
# ---------------------------------------------------------------------------

def test_section_as_text() -> None:
    b64 = to_base64url(stream([encode_text("Hello, StaticBin!")]))
    [section] = decode_stream(b64)
    assert section.as_text() == "Hello, StaticBin!"


def test_section_as_bitfield() -> None:
    flags = [True, False, False, True, True, False, True]
    b64 = to_base64url(stream([encode_bitfield(flags)]))
    [section] = decode_stream(b64)
    assert list(section.as_bitfield()) == flags


def test_section_as_ints() -> None:
    values = [1, 2, 5, 100, 32768]
    b64 = to_base64url(stream([encode_integers(values)]))
    [section] = decode_stream(b64)
    assert list(section.as_ints()) == values


def test_small_ints_pack_and_unpack() -> None:
    values = [0, 3, 7, 15, 1]
    b64 = to_base64url(stream([encode_small_ints(values, width=4)]))
    [section] = decode_stream(b64)
    assert section.width == 4
    assert list(section.as_ints()) == values


def test_integer_mode_rejects_zero() -> None:
    with pytest.raises(ValueError):
        encode_integers([1, 0, 3])


def test_fixed_mode_requires_uniform_width() -> None:
    with pytest.raises(ValueError):
        encode_fixed(["10", "110"])


# ---------------------------------------------------------------------------
# base64url
# ---------------------------------------------------------------------------

def test_base64url_strips_whitespace() -> None:
    assert from_base64url(" A\nA\tA ") == "000000000000000000"


def test_base64url_rejects_invalid_chars() -> None:
    with pytest.raises(ValueError):
        from_base64url("!!!")


# ---------------------------------------------------------------------------
# Realistic composite: shareable preset
# ---------------------------------------------------------------------------

def test_composite_preset() -> None:
    # Imagine a UI preset: theme enum (0..7), font-size enum (0..3),
    # density enum (0..3), and four boolean feature toggles.
    theme, font, density = 5, 2, 1
    flags = [True, False, True, True]

    encoded = to_base64url(stream([
        encode_small_ints([theme, font, density], width=3),
        encode_bitfield(flags),
    ]))

    [a, b] = decode_stream(encoded)
    assert list(a.as_ints()) == [theme, font, density]
    assert list(b.as_bitfield()) == flags
