# About Protocol

## Introduction

The Throttr Server, including the SDK's, implements a binary protocol on their codes. The protocol defines all the request types and responses in order to make transactions efficient and well-known. 

All the source code is available under the [official GitHub repository][]

## Definitions

If you want to understand the logic behind the scene, and you're developer or architect, then, this documentation is great for you because it explains byte per byte how Throttr message protocol works.

To start that process, I consider absolutely necessary talk about some concepts first.

### Time to Live (TTL)

Is a period of time computed from the `now()` function of the server plus the amount units on the respective time system used. During that period, the resource attached to the TTL can be considered as valid.

In example; a TTL of 60 seconds will be marked as expired and removed by the scheduler after a minute.

### TTL Types

Is the time unit system used to measure the TTL on the record.

The implemented types are:

| Name         | Binary |
|--------------|--------|
| Nanoseconds  | `0x01` |
| Microseconds | `0x02` |
| Milliseconds | `0x03` |
| Seconds      | `0x04` |
| Minutes      | `0x05` |
| Hours        | `0x06` |

### Record

Is an in-memory system entity, identify by a key. It can be a `counter` or `buffer`. 

Records are designed to expire in some time point. That point is established when the record is created and modified during TTL's updates.

### Key

Is a unique value to identify the record in the system. His value is stored in a binary container and comparable using hashing. You can define the keys that fit with your use cases.

### Maximum Values

The protocol defines a numeric limit to all operations and it must be selected to fit with the use case.

To understand this dimension, consider Quota as `X`, TTL as `Y` and Buffer as `Z`.

Then:

- To length of `Z` and value of `X` and `Y`:
  - Lower than `255` then use `uint8`.
  - Lower than `65.535` then use `uint16`.
  - Lower than `4.294.967.295` then use `uint32`.
  - Lower than `2^64 - 1` then use `uint64`.


> Why is so important?

Because if you choose the optimal variant, you'll reduce the RAM and Bandwidth used by the server and clients. If your cases can be solved by `uint8` then, using `uint64`, you'll be wasting `7 bytes` per dynamic field.

### Dynamic Value Size

The dynamic size (`N`) is the variable quantity of bytes who are used on dynamic fields, previously described to store and transmit data. So:

| Variant | Length  |
|---------|---------|
| uint8   | 1 byte  |
| uint16  | 2 bytes |
| uint32  | 4 bytes |
| uint64  | 8 bytes |

### Endianness

The endianness is the way how multibyte data is stored in memory.

**Big Endian** stores the most significant byte first, meaning the highest-order byte comes at the lowest memory address.

**Little Endian**, on the other hand, stores the least significant byte first.

For example, the number 2 represented in two bytes would be stored as:

- `0x00 0x02` in Big Endian
- `0x02 0x00` in Little Endian

This order affects how data is interpreted when reading raw bytes in memory or across systems.

Throttr use `little endian` by default. This reduces the amount of mathematical operations to reorder the data on compatible architecture. Almost all current CPU architecture uses little-endian by default. 

Usually, standards of `IETF`, `IEEE` and `ISO` recommend `big endian`. This protocol doesn't try go against the standard. The protocol tries avoid as possible, the undesired and forced conversion operations, in order to provide less contention.

## Request types

Version `v7.1.0` supports the following request types:

### INSERT

This request can add counters to the memory.

#### Required fields

##### Request type

The first `byte` must be `0x01`.

##### Quota

Is the consumable amount assigned to the key in the time-window. Contained in `N bytes`.

##### TTL type

Is the TTL type used by the counter. Contained in `1 byte`.

##### TTL

Is the amount in TTL units applicable to the counter. Contained in `N bytes`.

##### Size of key

Is the quantity of chars (`M`) used by the key. Contained in `1 byte`.

##### Key

Is the key of the record. Contained in `M bytes`.

#### Response

The server resolve this request by sending `1 byte` response.

The client will receive `0x01` on success or `0x00` on failure.

### QUERY

This request can retrieve `counters`.

#### Required fields

##### Request type

The first `byte` must be `0x02`.

##### Size of key

Is the quantity of chars (`M`) used by the key. Contained in `1 byte`.

##### Key

Is the key of the record. Contained in `M bytes`.

#### Response

The server, usually, resolve this request by sending `1 byte` response.

The client will receive `0x01` on success or `0x00` on failure.

If the status was `success`, then, it also will include:


| Field    | Size      |
|----------|-----------|
| QUOTA    | `N bytes` |
| TTL TYPE | `1 byte`  |
| TTL      | `N bytes` |

### UPDATE

This request can modify `counters` and `buffers`.

#### Required fields

##### Request type

The first `byte` must be `0x03`.

##### Attribute

Is the field to be modified. Contained in `1 byte`.

It can be:

| Attribute | Binary |
|-----------|--------|
| QUOTA     | `0x00` |
| TTL       | `0x01` |

> The `buffers` can only be modified using `TTL`.

##### Change type

Is the change type to be applied. Contained in `1 byte`. 

It can be:

| Change   | Binary |
|----------|--------|
| PATCH    | `0x00` |
| INCREASE | `0x01` |
| DECREASE | `0x02` |

> The `DECREASE` can produce `0x00` as response if the result of the operation over `Quota` is negative.


> Any operation over `TTL` will invoke the procedure to reschedule the expiration timer.


##### Value

Is the value to be used. Contained in `N bytes`.

##### Size of key

Is the quantity of chars (`M`) used by the key. Contained in `1 byte`.

##### Key

Is the key of the record. Contained in `M bytes`.

#### Response

This server resolve this request by sending `1 byte` response. 

The client will receive `0x01` on success or `0x00` on failure.

### PURGE

This request can remove `counters` and `buffers`.

#### Required fields

##### Request type

The first `byte` must be `0x04`.

##### Size of key

Is the quantity of chars (`M`) used by the key. Contained in `1 byte`.

##### Key

Is the key of the record. Contained in `M bytes`.

#### Response

This server resolve this request by sending `1 byte` response.

The client will receive `0x01` on success or `0x00` on failure.

### SET

This request can add buffers to the memory.

#### Required fields

##### Request type

The first `byte` must be `0x05`.

##### TTL type

Is the TTL type used by the counter. Contained in `1 byte`.

##### TTL

Is the amount in TTL units applicable to the counter. Contained in `N bytes`.

##### Size of key

Is the quantity of chars (`M`) used by the key. Contained in `1 byte`.


##### Size of value

Is the quantity of chars (`O`) used by the value. Contained in `1 byte`.

##### Key

Is the key of the record. Contained in `M bytes`.

##### Value

Is the value of the record. Contained in `O bytes`.

#### Response

The server resolve this request by sending `1 byte` response.

The client will receive `0x01` on success or `0x00` on failure.

### GET

This request can retrieve `buffers`.

#### Required fields

##### Request type

The first `byte` must be `0x06`.

##### Size of key

Is the quantity of chars (`M`) used by the key. Contained in `1 byte`.

##### Key

Is the key of the record. Contained in `M bytes`.

#### Response

The server, usually, resolve this request by sending `1 byte` response.

The client will receive `0x01` on success or `0x00` on failure.

If the status was `success`, then, it also will include:


| Field            | Size      |
|------------------|-----------|
| TTL TYPE         | `1 byte`  |
| TTL              | `N bytes` |
| VALUE SIZE (`O`) | `N bytes` |
| VALUE            | `O bytes` |

### LIST

This request can list `counters` and `buffers`.

#### Required fields

##### Request type

The first `byte` must be `0x07`.

#### Response

This server resolve this request, initially, by sending `8 bytes` response.


| Field              | Size      |
|--------------------|-----------|
| FRAGMENTS (P)      | `8 bytes` |

After that we receive P fragments in `16 bytes`:

| Field                     | Size      |
|---------------------------|-----------|
| FRAGMENT                  | `8 bytes` |
| NUMBER OF SCOPED KEYS (Q) | `8 bytes` |

Per `Q` we are going to receive fixed `11 + N bytes`:

| Field         | Size      |
|---------------|-----------|
| KEY SIZE (QL) | `1 byte`  |
| KEY TYPE      | `1 byte`  |
| TTL TYPE      | `1 byte`  |
| TIME POINT    | `8 bytes` |
| BYTES USED    | `N bytes` |

> `N` represent `value_type` length.

At the end of the fragment we are going receive the keys in `R bytes` (sum of `QL`):

| Field      | Size       |
|------------|------------|
| KEY        | `QL bytes` |

### INFO

This request can provide instance related information.

#### Required fields

##### Request type

The first `byte` must be `0x08`.

#### Response

This server resolve this request, initially, by sending `236 bytes` response.


| Field                             | Size       |
|-----------------------------------|------------|
| TIMESTAMP                         | `8 bytes`  |
| TOTAL REQUESTS                    | `8 bytes`  |
| REQUESTS PER MINUTE               | `8 bytes`  |
| TOTAL `INSERT`                    | `8 bytes`  |
| `INSERT` PER MINUTE               | `8 bytes`  |
| TOTAL `QUERY`                     | `8 bytes`  |
| `QUERY` PER MINUTE                | `8 bytes`  |
| TOTAL `UPDATE`                    | `8 bytes`  |
| `UPDATE` PER MINUTE               | `8 bytes`  |
| TOTAL `PURGE`                     | `8 bytes`  |
| `PURGE` PER MINUTE                | `8 bytes`  |
| TOTAL `GET`                       | `8 bytes`  |
| `GET` PER MINUTE                  | `8 bytes`  |
| TOTAL `SET`                       | `8 bytes`  |
| `SET` PER MINUTE                  | `8 bytes`  |
| TOTAL `LIST`                      | `8 bytes`  |
| `LIST` PER MINUTE                 | `8 bytes`  |
| TOTAL `INFO`                      | `8 bytes`  |
| `INFO` PER MINUTE                 | `8 bytes`  |
| TOTAL `STATS`                     | `8 bytes`  |
| `STATS` PER MINUTE                | `8 bytes`  |
| TOTAL `STAT`                      | `8 bytes`  |
| `STAT` PER MINUTE                 | `8 bytes`  |
| TOTAL `SUBSCRIBE`                 | `8 bytes`  |
| `SUBSCRIBE` PER MINUTE            | `8 bytes`  |
| TOTAL `UNSUBSCRIBE`               | `8 bytes`  |
| `UNSUBSCRIBE` PER MINUTE          | `8 bytes`  |
| TOTAL `PUBLISH`                   | `8 bytes`  |
| `PUBLISH` PER MINUTE              | `8 bytes`  |
| TOTAL `CHANNEL`                   | `8 bytes`  |
| `CHANNEL` PER MINUTE              | `8 bytes`  |
| TOTAL `CHANNELS`                  | `8 bytes`  |
| `CHANNELS` PER MINUTE             | `8 bytes`  |
| TOTAL `WHOAMI`                    | `8 bytes`  |
| `WHOAMI` PER MINUTE               | `8 bytes`  |
| TOTAL `CONNECTION`                | `8 bytes`  |
| `CONNECTION` PER MINUTE           | `8 bytes`  |
| TOTAL `CONNECTIONS`               | `8 bytes`  |
| `CONNECTIONS` PER MINUTE          | `8 bytes`  |
| TOTAL READ BYTES                  | `8 bytes`  |
| READ BYTES PER MINUTE             | `8 bytes`  |
| TOTAL WRITE BYTES                 | `8 bytes`  |
| WRITE BYTES PER MINUTE            | `8 bytes`  |
| TOTAL KEYS                        | `8 bytes`  |
| TOTAL COUNTERS                    | `8 bytes`  |
| TOTAL BUFFERS                     | `8 bytes`  |
| TOTAL ALLOCATED BYTES ON COUNTERS | `8 bytes`  |
| TOTAL ALLOCATED BYTES ON BUFFERS  | `8 bytes`  |
| TOTAL SUBSCRIPTIONS               | `8 bytes`  |
| TOTAL CHANNELS                    | `8 bytes`  |
| RUNNING SINCE                     | `8 bytes`  |
| TOTAL CONNECTIONS                 | `8 bytes`  |
| VERSION                           | `16 bytes` |

### STAT

This request can provide metrics for specific `counter` or `buffer`.

#### Required fields

##### Request type

The first `byte` must be `0x09`.

##### Size of key

Is the quantity of chars (`M`) used by the key. Contained in `1 byte`.

##### Key

Is the key of the record. Contained in `M bytes`.

#### Response

This server resolve this request by sending `1 byte` response.

If the byte is `0x01` then will also include `32 bytes` more:

| Field             | Size      |
|-------------------|-----------|
| READS PER MINUTE  | `8 bytes` |
| WRITES PER MINUTE | `8 bytes` |
| TOTAL READS       | `8 bytes` |
| TOTAL WRITES      | `8 bytes` |

### STATS

This request can provide metrics of `counters` and `buffers`.

#### Required fields

##### Request type

The first `byte` must be `0x10`.

#### Response

This server resolve this request, initially, by sending `8 bytes` response.


| Field              | Size      |
|--------------------|-----------|
| FRAGMENTS (P)      | `8 bytes` |

After that we receive P fragments in `16 bytes`:

| Field                     | Size      |
|---------------------------|-----------|
| FRAGMENT                  | `8 bytes` |
| NUMBER OF SCOPED KEYS (Q) | `8 bytes` |

Per `Q` we are going to receive fixed `33 bytes`:

| Field             | Size      |
|-------------------|-----------|
| KEY SIZE (QL)     | `1 byte`  |
| READS PER MINUTE  | `8 bytes` |
| WRITES PER MINUTE | `8 bytes` |
| TOTAL READS       | `8 bytes` |
| TOTAL WRITES      | `8 bytes` |

> `N` represent `value_type` length.

At the end of the fragment we are going receive the keys in `R bytes` (sum of `QL`):

| Field      | Size       |
|------------|------------|
| KEY        | `QL bytes` |

### SUBSCRIBE

This request can start a subscription to a `channel`.

#### Required fields

##### Request type

The first `byte` must be `0x11`.

##### Size of channel

Is the quantity of chars (`M`) used by the key. Contained in `1 byte`.

##### Channel

Is the name of the channel. Contained in `M bytes`.

#### Response

This server resolve this request by sending `1 byte` response.

The client will receive `0x01` on success or `0x00` on failure.

### UNSUBSCRIBE

This request can finish a subscription to a `channel`.

#### Required fields

##### Request type

The first `byte` must be `0x12`.

##### Size of channel

Is the quantity of chars (`M`) used by the key. Contained in `1 byte`.

##### Channel

Is the name of the channel. Contained in `M bytes`.

#### Response

This server resolve this request by sending `1 byte` response.

The client will receive `0x01` on success or `0x00` on failure.

### PUBLISH

This request can send a buffer to a subscribed `channel`.

#### Required fields

##### Request type

The first `byte` must be `0x13`.

##### Size of channel

Is the quantity of chars (`M`) used by the channel. Contained in `1 byte`.

##### Size of payload

Is the quantity of chars (`O`) used by the payload. Contained in `N bytes`.

##### Channel

Is the name of the channel. Contained in `M bytes`.

##### Payload

Is the payload. Contained in `O bytes`.

#### Response

This server resolve this request by sending `1 byte` response.

The client will receive `0x01` on success or `0x00` on failure.

[official GitHub repository]: https://github.com/throttr/protocol

### CONNECTIONS

This request can list `connections`.

#### Required fields

##### Request type

The first `byte` must be `0x14`.

#### Response

This server resolve this request, initially, by sending `8 bytes` response.

| Field              | Size      |
|--------------------|-----------|
| FRAGMENTS (P)      | `8 bytes` |

After that we receive P fragments in `16 bytes`:

| Field                            | Size      |
|----------------------------------|-----------|
| FRAGMENT                         | `8 bytes` |
| NUMBER OF SCOPED CONNECTIONS (Q) | `8 bytes` |

Per `Q` we are going to receive fixed `235 bytes`:

| Field                  | Size       |
|------------------------|------------|
| ID                     | `16 bytes` |
| IP VERSION             | `1 byte`   |
| IP                     | `16 bytes` |
| PORT                   | `2 byte`   |
| CONNECTED AT           | `8 bytes`  |
| READ BYTES             | `8 bytes`  |
| WRITE BYTES            | `8 bytes`  |
| PUBLISHED BYTES        | `8 bytes`  |
| RECEIVED BYTES         | `8 bytes`  |
| ALLOCATED BYTES        | `8 bytes`  |
| CONSUMED BYTES         | `8 bytes`  |
| `INSERT` REQUESTS      | `8 bytes`  |
| `SET` REQUESTS         | `8 bytes`  |
| `QUERY` REQUESTS       | `8 bytes`  |
| `GET` REQUESTS         | `8 bytes`  |
| `UPDATE` REQUESTS      | `8 bytes`  |
| `PURGE` REQUESTS       | `8 bytes`  |
| `LIST` REQUESTS        | `8 bytes`  |
| `INFO` REQUESTS        | `8 bytes`  |
| `STAT` REQUESTS        | `8 bytes`  |
| `STATS` REQUESTS       | `8 bytes`  |
| `PUBLISH` REQUESTS     | `8 bytes`  |
| `SUBSCRIBE` REQUESTS   | `8 bytes`  |
| `UNSUBSCRIBE` REQUESTS | `8 bytes`  |
| `CONNECTIONS` REQUESTS | `8 bytes`  |
| `CONNECTION` REQUESTS  | `8 bytes`  |
| `CHANNELS` REQUESTS    | `8 bytes`  |
| `CHANNEL` REQUESTS     | `8 bytes`  |
| `WHOAMI` REQUESTS      | `8 bytes`  |

### CONNECTION

This request can retrieve metadata about specific `connection`.

#### Required fields

##### Request type

The first `byte` must be `0x15`.

##### Connection index

The index contained in `4 bytes`.

#### Response

This server resolve this request, initially, by sending `1 byte` response.

If `index` exists then will also include fixed `235 bytes`:

| Field                  | Size       |
|------------------------|------------|
| ID                     | `16 bytes` |
| IP VERSION             | `1 byte`   |
| IP                     | `16 bytes` |
| PORT                   | `2 byte`   |
| CONNECTED AT           | `8 bytes`  |
| READ BYTES             | `8 bytes`  |
| WRITE BYTES            | `8 bytes`  |
| PUBLISHED BYTES        | `8 bytes`  |
| RECEIVED BYTES         | `8 bytes`  |
| ALLOCATED BYTES        | `8 bytes`  |
| CONSUMED BYTES         | `8 bytes`  |
| `INSERT` REQUESTS      | `8 bytes`  |
| `SET` REQUESTS         | `8 bytes`  |
| `QUERY` REQUESTS       | `8 bytes`  |
| `GET` REQUESTS         | `8 bytes`  |
| `UPDATE` REQUESTS      | `8 bytes`  |
| `PURGE` REQUESTS       | `8 bytes`  |
| `LIST` REQUESTS        | `8 bytes`  |
| `INFO` REQUESTS        | `8 bytes`  |
| `STAT` REQUESTS        | `8 bytes`  |
| `STATS` REQUESTS       | `8 bytes`  |
| `PUBLISH` REQUESTS     | `8 bytes`  |
| `SUBSCRIBE` REQUESTS   | `8 bytes`  |
| `UNSUBSCRIBE` REQUESTS | `8 bytes`  |
| `CONNECTIONS` REQUESTS | `8 bytes`  |
| `CONNECTION` REQUESTS  | `8 bytes`  |
| `CHANNELS` REQUESTS    | `8 bytes`  |
| `CHANNEL` REQUESTS     | `8 bytes`  |
| `WHOAMI` REQUESTS      | `8 bytes`  |

### CHANNELS

This request can list `channels`.

#### Required fields

##### Request type

The first `byte` must be `0x16`.

#### Response

This server resolve this request, initially, by sending `8 bytes` response.

| Field              | Size      |
|--------------------|-----------|
| FRAGMENTS (P)      | `8 bytes` |

After that we receive P fragments in `16 bytes`:

| Field                         | Size      |
|-------------------------------|-----------|
| FRAGMENT                      | `8 bytes` |
| NUMBER OF SCOPED CHANNELS (Q) | `8 bytes` |

Per `Q` we are going to receive fixed `21 bytes`:

| Field                  | Size      |
|------------------------|-----------|
| CHANNEL SIZE (QL)      | `1 byte`  |
| READ BYTES             | `8 bytes` |
| WRITE BYTES            | `8 bytes` |
| SUBSCRIBED CONNECTIONS | `4 bytes` |

At the end of the fragment we are going receive the keys in `R bytes` (sum of `QL`):

| Field   | Size       |
|---------|------------|
| CHANNEL | `QL bytes` |

### CHANNEL

This request can provide metrics for specific `channel`.

#### Required fields

##### Request type

The first `byte` must be `0x17`.

##### Size of channel

Is the quantity of chars (`M`) used by the key. Contained in `1 byte`.

##### Channel

Is the channel name. Contained in `M bytes`.

#### Response

This server resolve this request by sending `1 byte` response.

If the byte is `0x01` then will also include `4 bytes` more:

| Field                     | Size      |
|---------------------------|-----------|
| NUMBER OF SUBSCRIBERS (Q) | `8 bytes` |

Per `Q` we need to read `28 bytes`:

| Field         | Size       |
|---------------|------------|
| CONNECTION ID | `16 bytes` |
| SUBSCRIBED_AT | `8 bytes`  |
| READ BYTES    | `8 bytes`  |
| WRITE BYTES   | `8 bytes`  |

### WHOAMI

This request can provide the index of the current connection.

#### Required fields

##### Request type

The first `byte` must be `0x18`.

#### Response

This server resolve this request, by sending the connection ID in `16 bytes`.