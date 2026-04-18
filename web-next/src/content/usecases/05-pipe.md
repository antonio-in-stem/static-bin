---
title: Inter-process handshakes
order: 5
footnote: Stdin, stdout, pipes, WebSockets.
---

Two programs on the same machine rarely need a full schema exchange.
They just need to hand each other a small, well-formed packet of state.
StaticBin is the cheapest way to do that without pulling in a framing
library.
