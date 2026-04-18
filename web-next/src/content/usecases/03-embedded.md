---
title: Embedded & constrained runtimes
order: 3
footnote: No allocator? No filesystem? No problem.
---

Works on platforms that forbid external libraries or runtime file access.
The C99 port is header-only and allocator-free. The logic is small enough
to inline into microcontroller firmware without touching the build.
