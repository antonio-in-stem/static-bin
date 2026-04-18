# StaticBin · C99 port

Freestanding C, no dependencies beyond `libc`. Useful anywhere: from
desktop utilities down to embedded firmware where Python and Node are
not options.

## Build and run

```bash
make run
```

Expected output (identical to every other port):

```
empty     ->  A
text_hi   ->  BEhcQ0NI
bitfield  ->  Gptg
ints      ->  DmEaZCg
dynamic   ->  D8FNo4g
compound  ->  A1IE8QpujC6NLGhNLcl6
```

## Files

* `staticbin.h`: public API.
* `staticbin.c`: implementation.
* `demo.c`:     reproduces the spec's golden vectors.

## Memory ownership

All functions that return `char *` transfer ownership to the caller. The
caller must `free()` the pointer when done.

## Portability note

The implementation operates on NUL-terminated ASCII bit-strings of
`'0'`/`'1'`. That keeps the source a near-literal translation of the
Python reference. If you need a tight embedded build, pack the bit-string
into a bitset buffer; the algorithm does not change.
