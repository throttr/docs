# Get Started

## Run the Server

There are a different ways to get Throttr Server running.

### Using Binaries

This is the most easy and fast way to get an instance ready to accept connections and handle requests.

The first step is go to the [Throttr Server Repository][] and click on `Releases`.

![Assets per release](/images/releases-assets.png)

Download and extract it. You can run it by using the following command:

```bash
./throttr --port=9000 --threads=4
```

### Using Docker

This is the most easy and fast way to get 

```bash
// For Quotas/TTL and Buffers

// Upto 255
docker run -p 9000:9000 ghcr.io/throttr/throttr:4.0.14-debug-uint8

// Upto 65.535
docker run -p 9000:9000 ghcr.io/throttr/throttr:4.0.14-debug-uint16

// Upto 4.294.967.295
docker run -p 9000:9000 ghcr.io/throttr/throttr:4.0.14-debug-uint32

// Upto 2^64 - 1
docker run -p 9000:9000 ghcr.io/throttr/throttr:4.0.14-debug-uint64
```

### Building from Source

> This section is under construction.

## Software Development Kit's


| SDK                    | Documentation           |
|------------------------|-------------------------|
| [SDK for TypeScript][] | [TS: Read the docs][]   |
| [SDK for PHP][]        | [PHP: Read the docs][]  |
| [SDK for Java][]       | [Java: Read the docs][] |


[Throttr Server Repository]: https://github.com/throttr/throttr
[SDK for TypeScript]: https://github.com/throttr/typescript
[SDK for PHP]: https://github.com/throttr/php
[SDK for Java]: https://github.com/throttr/java
[TS: Read the docs]: ./sdk/typescript.md
[PHP: Read the docs]: ./sdk/php.md
[Java: Read the docs]: ./sdk/java.md