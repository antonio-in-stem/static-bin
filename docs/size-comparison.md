# Size comparison

All sizes are in printable characters: what you would actually paste
into a URL, a log line, or a QR code. Numbers are produced by the
reference Python implementation. "Compact JSON" uses short field names
and no whitespace.

## Example 1 · UI preset

State:

```
theme    = index 7 of 8    ("dracula")
density  = index 2 of 4    ("comfortable")
font     = index 3 of 5    ("L")
features = 4 bit-flags     [on, off, on, off]
```

| Encoding                                | Characters |
|-----------------------------------------|:----------:|
| Verbose JSON                            |    110     |
| Compact JSON (short keys, no spaces)    |     83     |
| **StaticBin**                           |    **8**   |

StaticBin output: `BCjH00ug`.

## Example 2 · Device status beacon

State:

```
firmware id     = "NODE-A7F3"   (9 chars)
battery_pct     = 87
uptime_hours    = 412
sensor_health   = 5 flags [on, on, on, off, on]
```

| Encoding           | Characters |
|--------------------|:----------:|
| Compact JSON       |     49     |
| **StaticBin**      |   **28**   |

StaticBin output: `ASiBPEJyeiIpagm6MZ4eArgGcTeg`.

## Example 3 · Single 16-bit integer

| Encoding           | Characters |
|--------------------|:----------:|
| Compact JSON `{"x":65535}`                |     11     |
| **StaticBin** `BIhkIf_-`                  |    **8**   |

StaticBin is not always dramatically shorter for a single value. The
win scales with structure: the more heterogeneous the state, the
larger the saving.

## Rule of thumb

* **Under 4 bytes of pure integers.** Raw base64 may edge it out.
* **Four or more fields of mixed type.** StaticBin wins decisively.
* **Over a hundred fields.** You are outside StaticBin's target
  envelope. Use Protobuf or gzipped JSON.
