# StaticBin

> Shared-schema state, compressed to a string.

**Version 1.0.0** · **Released January 2026** · **Status: production, stable wire**

Designed and built by **Antonio M.** for **StaticResearch**.

---

StaticBin is a tiny wire format for the case where both endpoints
already know the shape of the data. No keys. No type tags. No framing.
Just values, packed into a self-delimiting bitstream and rendered as
URL-safe text.

```text
stream([
    text("NODE-A7F3"),
    enums([5, 2, 1], w=3),
    flags([true, false, true, true]),
])

  â†’  "A_oE8QnJ6IilqCboxmjHUUuw"     (24 chars Â· 144 bits)
```

The equivalent JSON would take roughly 78 characters. Protobuf around 22
bytes plus a schema file. StaticBin does it in 24 printable characters
that paste cleanly into URLs, QR codes, filenames, and database
`VARCHAR(32)` columns.

---

## Why does this exist?

General-purpose serializers (JSON, Protobuf, MessagePack, CBOR) assume
the receiver does not know what is coming. They spend bytes on field
names, type tags, and framing. That is the right trade-off when the
schema is genuinely open-ended.

It is wasteful when both endpoints already agree. A twelve-field UI
preset that takes three hundred bytes of JSON carries maybe a dozen
bits of actual information. StaticBin strips everything the schema
already tells you. The schema lives in code, on both sides. Only the
values cross the wire.

### Born from a constraint

StaticBin is not a thought experiment. It was written to solve a very
concrete problem: a sandboxed runtime with no file-system access, no
third-party libraries, no binary I/O. Only short, ephemeral strings
flowing through a single text channel. Every piece of structured state
we needed to persist across invocations had to survive a round-trip
through that channel, character for character.

Existing formats were out of reach. Import-based libraries could not
be installed. Byte-level serializers could not run because the channel
rejected non-printable bytes. Schema-aware formats expected runtime
reflection we did not have. So we built the format the problem was
asking for: strings in, strings out, schemas compiled into code.

StaticBin is used in production today. Everything it does is still
anchored to that original constraint, which is also why the format is
this small.

### Non-goals

StaticBin does **not** try to be:

* a general serializer,
* good at large payloads,
* forward- or backward-compatible with unknown fields,
* self-describing,
* a transport. It is only a format.

If you need to send a megabyte of logs, use Protobuf or gzipped JSON.
If you need to fit twenty flags plus six enum values into a URL
fragment, StaticBin is for you.

---

## How it works, in one screen

Three primitive section types:

| Tag  | Mode     | Use                                                   |
|:----:|:---------|:------------------------------------------------------|
| `01` | FIXED    | Uniform-width chunks. Text, bitfields, packed enums.  |
| `10` | DYNAMIC  | Variable-width chunks.                                |
| `11` | INTEGER  | A list of positive integers.                          |

Each section is prefixed by its 2-bit tag and wrapped with an
Elias-gamma length header. All sections are concatenated and the whole
stream gets one more length wrap. The result is base64url-encoded.

Full specification: [`SPEC.md`](SPEC.md).

---

## Language ports

All implementations produce byte-identical base64 output for the test
vectors in [`SPEC.md Â§8`](SPEC.md#8-test-vectors).

| Language   | Status | Path                                  | Tests                  |
|------------|:------:|---------------------------------------|------------------------|
| Python 3.10+ | live | [`implementations/python/`](implementations/python/)     | `pytest`               |
| JavaScript (Node 18+, modern browsers) | live | [`implementations/javascript/`](implementations/javascript/) | `npm test`             |
| C99        | live      | [`implementations/c/`](implementations/c/)               | `make run`             |
| Fortran 2008 | live    | [`implementations/fortran/`](implementations/fortran/)   | `make run`             |

Adding a port is mostly a translation exercise. Once you can express
Elias-gamma and base64url in the target language, the rest is fairly
mechanical.

---

## Install

Every port is self-contained and can be vendored as a single file.
Package-manager releases are planned for v1.1; until then, install
from source.

### Python (3.10+)

```bash
git clone https://github.com/antonio-in-stem/static-bin.git
cd staticbin/implementations/python
pip install -e .

python -m pytest tests           # 31 passed
```

```python
from staticbin import (
    encode_text, encode_bitfield, encode_small_ints,
    stream, to_base64url, decode_stream,
)

code = to_base64url(stream([
    encode_text("NODE-A7F3"),
    encode_small_ints([5, 2, 1], width=3),
    encode_bitfield([True, False, True, True]),
]))

for section in decode_stream(code):
    print(section)
```

### JavaScript (Node 18+, modern browsers)

```bash
git clone https://github.com/antonio-in-stem/static-bin.git
cd staticbin/implementations/javascript
npm test                         # 22 passed

# vendor a single ES-module file into your own project
cp src/staticbin.mjs ../your-app/vendor/
```

```js
import {
  encodeText, encodeBitfield, encodeSmallInts,
  stream, toBase64Url, decodeStream,
} from "./vendor/staticbin.mjs";

const code = toBase64Url(stream([
  encodeText("NODE-A7F3"),
  encodeSmallInts([5, 2, 1], 3),
  encodeBitfield([true, false, true, true]),
]));
```

### C99

```bash
git clone https://github.com/antonio-in-stem/static-bin.git
cd staticbin/implementations/c
make run                         # prints the six golden vectors

# vendor two files into your own project
cp staticbin.h staticbin.c ../your-project/third_party/staticbin/
gcc -std=c99 -c third_party/staticbin/staticbin.c -o staticbin.o
```

### Fortran 2008

```bash
git clone https://github.com/antonio-in-stem/static-bin.git
cd staticbin/implementations/fortran
make run                         # prints the six golden vectors

# integrate into your own project
gfortran -c src/staticbin.f90 -Jyour_mods -o staticbin.o
```

### Verifying a build

Every port ships with the six golden vectors from [`SPEC.md`](SPEC.md#8-test-vectors).
If your output matches byte-for-byte, you are wire-compatible with every
other implementation.

---

## Design credo

* **Values only.** The schema is a compile-time contract, not wire data.
* **Self-delimiting.** Elias-gamma length prefixes, nothing else.
* **Deterministic.** Same input, same bytes, always.
* **Auditable.** Every port is written to read like the spec.

---

## Roadmap · honest limits

StaticBin v1 is **frozen at the wire level**. It is in active production
use and will not break that contract. Any evolution happens on a
separate, versioned track, never by silently shifting the meaning of
existing bits.

Several directions stay open. Whether any of them actually ship depends
on whether the problem they solve is real for someone. v1 may well
still be the format in five years.

| Direction                          | Status     | Notes                                                                                          |
|------------------------------------|:----------:|------------------------------------------------------------------------------------------------|
| On-wire versioning envelope        | considering | Today the schema lives in code and the format carries no self-identification.                 |
| Backward-compatibility reader      | considering | Reserved mode tag `00` in v1 is the natural upgrade hook.                                     |
| Native floating-point mode         | considering | Currently floats pack as FIXED(32) or FIXED(64) bit patterns (workable, not elegant).          |
| Integrity envelope (CRC / hash)    | considering | Probably optional; most callers already have that layer above them.                           |
| More language ports (Rust, Go, Zig) | likely    | Each port is an afternoon, not a project.                                                     |
| Self-describing schemas            | **never**  | Carrying field names on the wire is exactly what StaticBin refuses to do.                     |

---

## About

Designed and built by **Antonio M.** for **StaticResearch**.

Released as **v1.0.0** in **January 2026**.

---

## License

MIT. See [`LICENSE`](LICENSE).
