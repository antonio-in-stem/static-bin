"""StaticBin: compact, shared-schema state serialization.

Public surface:

    encode_fixed     encode_dynamic    encode_integers
    encode_text      encode_bitfield   encode_small_ints
    stream           to_base64url      from_base64url
    decode_stream    Section           Mode

See SPEC.md at the repository root for the wire format.
"""

from .codec import (
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

__version__ = "1.0.0"
__all__ = [
    "Mode",
    "Section",
    "decode_stream",
    "encode_bitfield",
    "encode_dynamic",
    "encode_fixed",
    "encode_integers",
    "encode_small_ints",
    "encode_text",
    "from_base64url",
    "stream",
    "to_base64url",
]
