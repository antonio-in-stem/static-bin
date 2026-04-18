# StaticBin · Fortran 2008 port

Proof that the format is genuinely language-agnostic: this implementation
is written in standard Fortran 2008 and requires nothing more than
`gfortran` (or `ifx`).

## Build and run

```bash
make run
```

Expected output (identical base64 strings to every other port; see
`SPEC.md §8`):

```
empty     ->  A
text_hi   ->  BEhcQ0NI
bitfield  ->  Gptg
ints      ->  DmEaZCg
dynamic   ->  D8FNo4g
compound  ->  A1IE8QpujC6NLGhNLcl6
```

## Files

* `src/staticbin.f90`: codec module (primitives, sections, base64url).
* `examples/demo.f90`: reproduces the golden vectors from the spec.

## Design notes

Bit-strings are carried as ordinary ASCII character arrays of `'0'` and
`'1'`. This deliberately privileges readability and 1:1 correspondence
with the Python reference over raw-speed micro-optimisation. If you need
a tight, production-grade Fortran port, collapse the bit-strings into a
packed integer buffer; the algorithm is unchanged.
