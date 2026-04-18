# StaticBin · Python reference implementation

The canonical implementation. All language ports cross-validate their
output against the test vectors pinned in `tests/test_codec.py`.

## Install

```bash
pip install -e .
# or, for development:
pip install -e ".[dev]"
```

Runtime has **zero** third-party dependencies.

## Usage

```python
from staticbin import (
    encode_text, encode_bitfield, encode_small_ints,
    stream, to_base64url, decode_stream,
)

code = to_base64url(stream([
    encode_text("NODE-A7F3"),
    encode_small_ints([5, 2, 1], width=3),          # three enums
    encode_bitfield([True, False, True, True]),     # four flags
]))

# -> compact, URL-safe, fits in a QR code:
print(code)

for section in decode_stream(code):
    print(section)
```

## CLI

```bash
staticbin encode --text "hi"
staticbin encode --ints 3,1,4,1,5
staticbin decode BEhcQ0NI
```

## Run the test suite

```bash
pytest
```

The suite includes the six golden vectors from `SPEC.md §8`.
