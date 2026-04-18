"""Command-line interface.

    python -m staticbin encode --text "hello"
    python -m staticbin encode --bits 10110 --bits 01
    python -m staticbin encode --ints 3,1,4,1,5
    python -m staticbin decode A1IE8QpujC6NLGhNLcl6
"""

from __future__ import annotations

import argparse
import sys

from . import (
    Mode,
    decode_stream,
    encode_bitfield,
    encode_dynamic,
    encode_fixed,
    encode_integers,
    encode_text,
    stream,
    to_base64url,
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="staticbin",
        description="StaticBin reference CLI",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    enc = sub.add_parser("encode", help="Encode a stream to base64url")
    enc.add_argument("--text",   action="append", default=[], help="UTF-8 text section")
    enc.add_argument("--bits",   action="append", default=[],
                     help="FIXED section from uniform-width bit-string, e.g. '10110'. "
                          "Pass a comma-separated group if the string mixes widths.")
    enc.add_argument("--dynamic", action="append", default=[],
                     help="DYNAMIC section as comma-separated bit chunks, e.g. '1,010,0001000'")
    enc.add_argument("--ints",   action="append", default=[],
                     help="INTEGER section as comma-separated positive integers, e.g. '3,1,4,1,5'")

    dec = sub.add_parser("decode", help="Decode a base64url stream")
    dec.add_argument("input", help="base64url-encoded StaticBin stream")
    return parser


def _encode(args: argparse.Namespace) -> str:
    sections: list[str] = []
    for text in args.text:
        sections.append(encode_text(text))
    for bits in args.bits:
        if "," in bits:
            chunks = bits.split(",")
            sections.append(encode_fixed(chunks))
        else:
            sections.append(encode_bitfield([c == "1" for c in bits]))
    for spec in args.dynamic:
        chunks = [c for c in spec.split(",") if c]
        sections.append(encode_dynamic(chunks))
    for spec in args.ints:
        values = [int(v) for v in spec.split(",") if v]
        sections.append(encode_integers(values))
    return to_base64url(stream(sections))


def _decode(args: argparse.Namespace) -> str:
    lines: list[str] = []
    for idx, section in enumerate(decode_stream(args.input), start=1):
        prefix = f"[{idx}] {section.mode.name}"
        if section.mode is Mode.FIXED and section.width == 8:
            try:
                lines.append(f"{prefix}  text   {section.as_text()!r}")
                continue
            except Exception:                                            # noqa: BLE001
                pass
        if section.mode is Mode.FIXED:
            lines.append(f"{prefix}  w={section.width}  {list(section.chunks)}")
        elif section.mode is Mode.DYNAMIC:
            lines.append(f"{prefix}  {list(section.chunks)}")
        else:
            lines.append(f"{prefix}  {list(section.chunks)}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    if args.command == "encode":
        print(_encode(args))
        return 0
    if args.command == "decode":
        print(_decode(args))
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
