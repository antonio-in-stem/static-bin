# Design philosophy

A short essay on why StaticBin looks the way it does.

## Schemas live in code, not on the wire

This is the central axiom. Every other design choice follows from it.

If the schema is known at compile-time on both sides, transmitting field
names, lengths of structs, or type tags is pure overhead. We pay for
information the reader already has. StaticBin refuses to.

The trade-off is explicit: a StaticBin stream is meaningless without
the code that produced it. Feed the receiver a different schema and you
get garbage back, silently. That is a feature, not a bug. The wire
format declines to protect you from bad code; it trusts both endpoints
to know what they agreed on.

## Three primitives are enough

Most binary formats grow organically: they start with a handful of
types, add varints, then fixed integers, then length-delimited records,
then optional fields, then extensions, then deprecation markers. Each
addition is reasonable in isolation. The sum is a format you cannot
hold in your head.

StaticBin has exactly three section types, and they map 1:1 to the
three ways a small state actually looks in practice:

* **FIXED**: a list of things of the same shape (bytes of a string,
  flags, packed enums).
* **DYNAMIC**: a list of things of different shape, where the shape
  matters at runtime.
* **INTEGER**: a list of positive counts.

That is the entire format. No union types, no optional wrappers, no
schema extensions. If you need more expressiveness, it is cheaper to
introduce a schema-level enum than to grow the format.

## Elias-gamma is boring, and that is good

We chose Elias-gamma not because it is clever but because it is
pedagogically trivial. You can explain it in three minutes to someone
who has never seen prefix codes before. That matters when you are
porting the format to a new language in an afternoon.

Fancier codes exist (Golomb-Rice, arithmetic, ANS). They produce
tighter streams. They are also harder to implement correctly, harder
to debug, and harder to trust. For payloads under a few hundred bits,
the savings are negligible. For payloads where they are not negligible,
StaticBin is the wrong tool.

## Base64url, not binary

A format that outputs raw bytes is a format that cannot fit in a URL,
a QR code, a JSON string, a Slack message, or a filename. The entire
point of StaticBin is to carry structured state through places where
binary is awkward. We pay a 33% inflation penalty on the final
character count. We win every other axis: copy-paste safety, logging,
grep-ability, user-visible debugging.

## Determinism over cleverness

There is exactly one valid output for any given input. No optional
ordering, no reserved bits, no "encoder-defined" behaviours. Two
implementations disagreeing on a byte is a bug, not a choice.

This makes StaticBin streams **content-addressable**. The base64 string
itself can serve as a cache key, a URL fragment, an index into a
database. Two clients that encode the same state independently produce
exactly the same key.

## What StaticBin is not

* **Not a replacement for JSON.** JSON is a configuration format, a
  human-editable data language, and an API lingua franca. StaticBin is
  none of those.
* **Not a replacement for Protobuf.** Protobuf carries schemas across
  organisational boundaries. StaticBin assumes both sides are inside
  the same trust boundary.
* **Not a compression format.** It does not compress data; it removes
  metadata that would not have been there in the first place if the
  schema were implicit.

Use the right tool. StaticBin is a scalpel, not a chainsaw.
