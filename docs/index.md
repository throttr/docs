---
home: true
title: Home
heroImage: /images/logo.png
actions:
  - text: Get Started
    link: /get-started.html
    type: primary

features:
  - title: Sovereign real-time data & messaging engine
    details: Combines rate limiting, caching, and a robust pub/sub system to deliver instant, reliable services over channels, subscriptions, and live messaging.

  - title: Fully asynchronous binary protocol with rich request types
    details: Supports 23+ optimized binary request types, from counter control to advanced management of connections, channels, metrics, and messages.

  - title: Channel-based pub/sub architecture with fine-grained subscriptions
    details: Custom channels enable managing targeted message streams to dynamic groups, with efficient subscribe, unsubscribe, and publish operations.

  - title: Comprehensive connection metadata and lifecycle tracking
    details: Each connection monitors bytes read, written, published messages, requests per type, and duration, facilitating diagnostics and optimization.

  - title: Advanced metrics and statistics collection per key, channel, and connection
    details: Measures reads, writes, and activity in real time for each entity, enabling detailed analysis and granular reporting.

  - title: Flexible TTL system with multiple time units and automatic expiration
    details: Adaptable TTLs from nanoseconds to hours, with dynamic rescheduling and instant cleanup to keep memory efficient.

  - title: Adaptive dynamic field sizing for optimal bandwidth and memory use
    details: Uses uint8, uint16, uint32, or uint64 as needed for quota, TTL, sizes, and payloads, minimizing overhead.

  - title: Binary key-value model supporting arbitrary binary blobs as keys and values
    details: Keys and values are strict-length binary fields with hashing, enabling efficient and safe raw data manipulation.

  - title: Horizontally scalable with limits set by hardware and deployment design
    details: The system scales based on physical capacity and architecture, allowing deployments from single servers to complex production clusters.

footer: AGPLv3 Licensed | Copyright © 2025-present Ian Torres
---
