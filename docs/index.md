---
home: true
title: Home
heroImage: /images/logo.png
actions:
  - text: Get Started
    link: /get-started.html
    type: primary

features:
  - title: Binary protocol crafted for high-performance control
    details: Each message is structured at the byte level to ensure total control, minimal overhead, and absolute decoding consistency at scale.
  - title: In-memory data engine with TTL-aware persistence
    details: All records exist only in RAM, with their lifetime defined by TTL; once expired, they’re purged instantly by a background scheduler.
  - title: Explicit TTL system with scheduler-driven cleanup
    details: Every record gets a lifespan in nanoseconds to hours, and when the time runs out, the internal engine removes it without exception.
  - title: Six atomic operations with strict protocol rules
    details: You get INSERT, QUERY, UPDATE, PURGE, SET, and GET; each has a unique binary code and validates structure before doing anything.
  - title: Adaptive field sizing to minimize memory pressure
    details: Dynamic values like quota, TTL and buffers are encoded using uint8, 16, 32 or 64 based on length—no byte is wasted in transit.
  - title: Strong key-value model with binary-raw semantics
    details: Keys are unique binary blobs; values can store any data. The protocol treats both as strict-length fields with hashing support.

footer: AGPLv3 Licensed | Copyright © 2025-present Ian Torres
---
