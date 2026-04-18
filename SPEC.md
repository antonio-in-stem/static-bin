# StaticBin Wire Format · Specification v1

Status: stable
Editor: the StaticBin authors
License: CC0 (this document), MIT (reference implementations)

---

## 1. Purpose

StaticBin encodes small, fixed-shape state into a compact, self-delimiting
bitstream rendered as a URL-safe string. It is designed for the case where
**both endpoints already share the schema**, so the wire carries values
only. No field names, no type tags, no framing metadata.

Non-goals: streaming, large payloads, forward/backward compatibility of
unknown fields, self-describing parsing.

## 2. Conventions

* All bit-strings in this document are written most-significant-bit first.
* The symbols `0` and `1` are literal bits. Spaces are for readability.
* `||` denotes bit-string concatenation.
* `N` and `k` denote non-negative integers.

## 3. Primitive: Elias-gamma

### 3.1 Header of a positive integer

For `N ≥ 1`, let `bin(N)` be the minimal binary representation of `N`
(no leading zeros) and `k = len(bin(N))`. The Elias-gamma **header** is:

```
header(N) = 0^(k-1) || bin(N)
```

| `N` | `bin(N)` | `header(N)` |
|----:|:---------|:------------|
|  1  | `1`      | `1`         |
|  2  | `10`     | `010`       |
|  3  | `11`     | `011`       |
|  4  | `100`    | `00100`     |
|  7  | `111`    | `00111`     |
|  8  | `1000`   | `0001000`   |
| 23  | `10111`  | `000010111` |

### 3.2 Header of zero

By convention, `header(0) = 0` (one bit). Zero only appears as a sentinel
for an **empty payload** inside a wrapper (§3.3). No section encodes a
meaningful zero via `header(0)`.

### 3.3 Wrap

The **wrap** operation prefixes a payload with the Elias-gamma header of
its bit-length:

```
wrap(payload) = header(len(payload)) || payload         (if payload != "")
wrap("")      = 0
```

### 3.4 Decoding

To **decode a header**, read leading `0` bits until a `1` is found; call
the count `z`. Then read `z + 1` bits and interpret them as an unsigned
integer (MSB first). The result is the decoded value.

To **unwrap**, decode a header `L`, then read the next `L` bits as the
payload.

## 4. Sections

A section is one logical record. Every section starts with a 2-bit **mode
tag**:

| Tag  | Mode     | Purpose                                    |
|:----:|:---------|:-------------------------------------------|
| `00` | reserved | Not used in v1. Decoders must reject.       |
| `01` | FIXED    | Uniform-width binary chunks.                |
| `10` | DYNAMIC  | Variable-width binary chunks.               |
| `11` | INTEGER  | Positive integer list.                      |

### 4.1 FIXED (tag `01`)

Input: a list of `m` bit-strings, each exactly `w` bits wide.

```
payload = header(w) || chunk_0 || chunk_1 || ... || chunk_{m-1}
section = 01 || wrap(payload)
```

Canonical recipes that reduce to FIXED:

* **Text**: split the string into bytes; each byte is an 8-bit chunk.
  `w = 8`.
* **Bitfield**: each flag is a single bit. `w = 1`.
* **Small enums**: encode `(index + 1)` in 7 bits to reserve `0` as "unset".
  `w = 7`.

### 4.2 DYNAMIC (tag `10`)

Input: a list of `m` bit-strings of possibly varying width.

```
payload = wrap(chunk_0) || wrap(chunk_1) || ... || wrap(chunk_{m-1})
section = 10 || wrap(payload)
```

### 4.3 INTEGER (tag `11`)

Input: a list of `m` positive integers `n_i ≥ 1`.

```
payload = header(n_0) || header(n_1) || ... || header(n_{m-1})
section = 11 || wrap(payload)
```

Encoders MUST reject `0` in this mode. Decoders that encounter `0` here
SHOULD report a schema error.

## 5. Stream

A **stream** is the concatenation of sections, wrapped once globally and
rendered as base64url.

```
stream_bits = wrap( section_0 || section_1 || ... || section_{s-1} )
```

### 5.1 Base64url encoding

Let `b = len(stream_bits) mod 6`. If `b != 0`, append `6 - b` zero bits
(right padding). Split the result into groups of 6 bits and map each
group to a character of the alphabet:

```
A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
a b c d e f g h i j k l m n o p q r s t u v w x y z
0 1 2 3 4 5 6 7 8 9 - _
```

No `=` padding is emitted. Padding bits are recovered implicitly by the
outer `header(L)` when decoding.

### 5.2 Decoding a stream

1. base64url-decode to a bitstream.
2. Unwrap: read the global header `L`, then the next `L` bits constitute
   the payload. Ignore trailing bits (they are padding).
3. Repeatedly read sections from the payload until it is exhausted:
   read the 2-bit mode tag, unwrap the section body, then interpret
   according to §4.

## 6. Determinism

For any given input schema and values, there exists exactly one valid
output string. The format has no optional flags, no reserved-for-future
bits, no alternative orderings.

## 7. Versioning

The version number is carried **out of band** by the schema. If you need
on-wire versioning, prepend an INTEGER section whose single value is the
version number. StaticBin deliberately does not reserve space for this.

## 8. Test vectors

| Input (semantic)                              | Mode | Base64url              |
|-----------------------------------------------|:----:|:-----------------------|
| `[]` (empty stream)                           | none | `A`                    |
| text `"hi"`                                   | 01   | `BEhcQ0NI`             |
| bitfield `[1,0,1,1,0]`                        | 01   | `Gptg`                 |
| integers `[1,2,3,4,5]`                        | 11   | `DmEaZCg`              |
| dynamic `["1","010","0001000"]`               | 10   | `D8FNo4g`              |
| text `"StaticBin"` then bitfield `[1,1,0,1]`  | 01,01| `A1IE8QpujC6NLGhNLcl6` |

Implementations MUST produce exactly these outputs. These vectors are
validated by the Python and JavaScript reference ports; see their test
suites for machine-readable form.

## 9. Reference implementations

Canonical behaviour is defined by the test vectors above and by the
Python reference in `implementations/python/`. Ports exist in
JavaScript, C99, and Fortran 2008.
