# StaticBin · JavaScript port

Pure ES module. No dependencies. Runs in Node 18+ and every modern
browser with no transpilation.

## Install

```bash
npm install staticbin
```

Or drop `src/staticbin.mjs` into your project and `import` it directly.

## Usage

```js
import {
  encodeText, encodeBitfield, encodeSmallInts,
  stream, toBase64Url, decodeStream,
} from "staticbin";

const code = toBase64Url(stream([
  encodeText("NODE-A7F3"),
  encodeSmallInts([5, 2, 1], 3),
  encodeBitfield([true, false, true, true]),
]));

console.log(code); // -> "ASiBPEJyeiIpagm6..." (URL-safe, QR-friendly)

for (const section of decodeStream(code)) console.log(section);
```

## In the browser

```html
<script type="module">
  import { toBase64Url, stream, encodeText }
    from "./src/staticbin.mjs";

  const code = toBase64Url(stream([encodeText("hello")]));
  location.hash = "p=" + code;
</script>
```

The web showcase at `/web/` is a complete worked example.

## Run tests

```bash
npm test
```

Twenty-two tests run under the built-in Node test runner (no framework
needed).
