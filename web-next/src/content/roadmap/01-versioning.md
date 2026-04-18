---
title: Versioned streams & backwards compatibility
order: 1
status: considering
---

Right now, two endpoints have to share the exact same schema revision. A
tiny prefix, one or two bytes, could signal version. Downstream decoders
could then accept older payloads gracefully, or reject them loudly.
Designing that without killing the format's minimalism is the open question.
