---
title: Integrity & tamper checks
order: 2
status: planned
---

An optional CRC-16 or truncated SHA footer would let receivers tell a
corrupted stream apart from a valid one with an unknown schema. For now,
validation is schema-level: if the decoded values are out of range,
something went wrong.
