---
title: Rice coding for skewed integers
order: 3
status: considering
---

Elias-gamma is the honest, generic default. Workloads with known skewed
distributions (most values small, a long tail of larger ones) could
benefit from a Rice coder with a schema-declared parameter. Worth the
complexity? Probably not for v1. Maybe for v2.
