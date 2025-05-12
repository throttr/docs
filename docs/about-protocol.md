# About Protocolo Throttr

This is a normal page, which contains VuePress basics.

## Introduction

The Throttr server and SDK's, implements a binary protocol on their codes. This protocol defines all the request types and responses. 

## Definitions

### Time to Live (TTL)

Is a period of time computed from the `now()` function of the server plus the amount units on the respective time system used. During that period, the TTL can be considered as valid.

Using other words, a TTL defined to 60 seconds will be marked as expired and removed by the scheduler after a minute.

### TTL type

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

### Maximum values

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

### Dynamic value size

The dynamic size (`N`) is the variable quantity of bytes who are used on dynamic fields, previously described to store and transmit data. So:

| Variant | Length  |
|---------|---------|
| uint8   | 1 byte  |
| uint16  | 2 bytes |
| uint32  | 4 bytes |
| uint64  | 8 bytes |


## Request types

Version `v5.0.0` supports the following request types:

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

#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [0x01 0x02 0x00 0x04 0x03 0x00 0x05 0x07 0x07 0x07 0x07 0x07];

// Explain the buffer ...
explain(buffer);

===================================================
== Request Type: 0x01             => INSERT      ==
== Quota: 0x02 0x00               => 2           ==
== TTL Type: 0x04                 => seconds     ==
== TTL: 0x03 0x00                 => 3           ==
== Length(Key): 0x05              => 5           ==
== Key: 0x07 0x07 0x07 0x07 0x07  => bytes       ==
===================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv()

// Explain the response ...
explain(response);

// If the key doesn't exists ...

==================
== Buffer: 0x01 ==
==================

=============================
== Status: 0x01 => success ==
=============================

// Or if the key exists ...

==================
== Buffer: 0x00 ==
==================

=============================
== Status: 0x00 => failed  ==
=============================
```

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

#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [0x02 0x05 0x07 0x07 0x07 0x07 0x07];

// Explain the buffer ...
explain(buffer);

================================================
== Buffer: 0x02 0x05 0x07 0x07 0x07 0x07 0x07 ==
================================================

===================================================
== Request Type: 0x02             => QUERY       ==
== Length(Key): 0x05              => 5           ==
== Key: 0x07 0x07 0x07 0x07 0x07  => bytes       ==
===================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv()

// Explain the response ...
explain(response);

// If the key exists then ...

=====================================
Buffer: 0x01 0x02 0x00 0x04 0x03 0x00
=====================================

=====================================
== Status: 0x01         => success ==
== Quota: 0x02 0x00     => 2       ==
== TTL Type: 0x04       => seconds ==
== TTL: 0x03 0x00       => 3       ==
=====================================

// Or if the key doesn't exists ...

==================
== Buffer: 0x00 ==
==================

=====================================
== Status: 0x00         => failed  ==
=====================================
```

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

#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [0x02 0x05 0x07 0x07 0x07 0x07 0x07];

// Explain the buffer ...
explain(buffer);

====================================================================
== Buffer: 0x03 0x00 0x01 0x02 0x00 0x05 0x07 0x07 0x07 0x07 0x07 ==
====================================================================

===================================================
== Request Type: 0x03             => UPDATE      ==
== Attribute: 0x00                => QUOTA       ==
== Change: 0x01                   => INCREASE    ==
== Value: 0x02 0x00               => 2           ==
== Length(Key): 0x05              => 5           ==
== Key: 0x07 0x07 0x07 0x07 0x07  => bytes       ==
===================================================

// Write on socket.
socket.send(buffer)

// Read from socket.
set response = socket.recv()

// Explain the response ...
explain(response);

// If the key exists or the change was valid then ...

==================
== Buffer: 0x01 ==
==================

=====================================
== Status: 0x01         => success ==
=====================================

// Otherwise ...

==================
== Buffer: 0x00 ==
==================

=====================================
== Status: 0x00         => failed  ==
=====================================
```

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


#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [0x02 0x05 0x07 0x07 0x07 0x07 0x07];

// Explain the buffer ...
explain(buffer);

================================================
== Buffer: 0x04 0x05 0x07 0x07 0x07 0x07 0x07 ==
================================================

===================================================
== Request Type: 0x02             => PURGE       ==
== Length(Key): 0x05              => 5           ==
== Key: 0x07 0x07 0x07 0x07 0x07  => bytes       ==
===================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv()

// Explain the response ...
explain(response);

// If the key exists previously ...

==================
== Buffer: 0x01 ==
==================

=====================================
== Status: 0x01         => success ==
=====================================

// Otherwise ...

==================
== Buffer: 0x00 ==
==================

=====================================
== Status: 0x00         => failed  ==
=====================================
```