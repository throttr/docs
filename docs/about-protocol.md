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

Version `v6.0.0` supports the following request types:

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
set buffer = [
  0x01
  0x02 0x00 
  0x04 
  0x03 0x00 
  0x05 
  0x07 0x07 0x07 0x07 0x07
];

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
set buffer = [
  0x02
  0x05 
  0x07 0x07 0x07 0x07 0x07
];

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
set buffer = [
  0x02 
  0x05 
  0x07 0x07 0x07 0x07 0x07
];

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
set buffer = [
  0x04
  0x05 
  0x07 0x07 0x07 0x07 0x07
];

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

#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [
  0x05 
  0x04 
  0x03 0x00 
  0x05 
  0x04 0x00 
  0x07 0x07 0x07 0x07 0x07 
  0x45 0x48 0x4C 0x4F
];

// Explain the buffer ...
explain(buffer);

===================================================
== Request Type: 0x05             => SET         ==
== TTL Type: 0x04                 => seconds     ==
== TTL: 0x03 0x00                 => 3           ==
== Length(Key): 0x05              => 5           ==
== Length(Value): 0x04 0x00       => 4           ==
== Key: 0x07 0x07 0x07 0x07 0x07  => bytes       ==
== Value: 0x45 0x48 0x4C 0x4F     => EHLO        ==
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

#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [
  0x06
  0x05 
  0x07 0x07 0x07 0x07 0x07
];

// Explain the buffer ...
explain(buffer);

================================================
== Buffer: 0x06 0x05 0x07 0x07 0x07 0x07 0x07 ==
================================================

===================================================
== Request Type: 0x06             => GET         ==
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

=========================================================
Buffer: 0x01 0x04 0x03 0x00 0x04 0x00 0x45 0x48 0x4C 0x4F
=========================================================

=============================================
== Status: 0x01                 => success ==
== Quota: 0x02 0x00             => 2       ==
== TTL Type: 0x04               => seconds ==
== TTL: 0x03 0x00               => 3       ==
== Size(Value): 0x04 0x00       => 4       ==
== Value:0x45 0x48 0x4C 0x4F    => EHLO    ==
=============================================

// Or if the key doesn't exists ...

==================
== Buffer: 0x00 ==
==================

=====================================
== Status: 0x00         => failed  ==
=====================================
```

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


#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [
  0x07
];

// Explain the buffer ...
explain(buffer);

==================
== Buffer: 0x07 ==
==================

===================================================
== Request Type: 0x07             => LIST        ==
===================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv(8)

// Explain the head response ...
explain(response);

=====================================================
== Buffer: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00 ==
=====================================================

=============================================================
== Fragments: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00 => 1 ==
=============================================================

for P = response.fragments; P != 0; P--

  set fragment_response = socket.recv(16)
  
  explain(fragment_response)
   
  ========================================================================
  == Fragment: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00             => 1 ==
  == N of Scoped Keys: 0x02 0x00 0x00 0x00 0x00 0x00 0x00 0x00     => 2 ==
  ========================================================================

  set keys_response = socket.recv(fragment_response.keys * 11)
  
  explain(keys_response)
  
  ==============
  == Key N° 1 ==
  ===================================================================================
  == Size Of Key: 0x03                                      => 3                   ==
  == Key Type: 0x00                                         => counter             ==
  == TTL Type: 0x04                                         => seconds             ==
  == Time Point: 0x00 0x35 0xD7 0xC5 0x15 0x18 0x42 0x18    => 1747986087165768960 ==
  == Bytes Used: 0x04 0x00                                  => 4 bytes             ==
  ===================================================================================
  
  ==============
  == Key N° 2 ==
  ===================================================================================
  == Size Of Key: 0x04                                      => 4                   ==
  == Key Type: 0x01                                         => buffer              ==
  == TTL Type: 0x04                                         => seconds             ==
  == Time Point: 0x00 0x35 0xD7 0xC5 0x15 0x18 0x42 0x18    => 1747986087165768960 ==
  == Bytes Used: 0x08 0x00                                  => 8 bytes             ==
  ===================================================================================

  set pending_bytes = 0;

  for each keys_response.items as item
  
    set key_response = socket.recv(item.size_of_key)
    
    explain(key_response)

    // 1st iteration:

    ============================
    == Buffer: 0x61 0x62 0x63 ==
    ============================
    
    ==============
    == Key N° 1 ==
    ================================
    == Key: 0x61 0x62 0x63 => abc ==
    ================================
    
    // 2nd iteration: 
    
    =================================
    == Buffer: 0x45 0x48 0x4C 0x4F ==
    =================================
    
    ==============
    == Key N° 2 ==
    ======================================
    == Key: 0x45 0x48 0x4C 0x4F => EHLO ==
    ======================================
```

### INFO

This request can provide instance related information.

#### Required fields

##### Request type

The first `byte` must be `0x08`.

#### Response

This server resolve this request, initially, by sending `236 bytes` response.


| Field                                 | Size       |
|---------------------------------------|------------|
| TIMESTAMP                             | `8 bytes`  |
| REQUEST PER SECONDS                   | `8 bytes`  |
| INSERT PER SECONDS                    | `8 bytes`  |
| QUERY PER SECONDS                     | `8 bytes`  |
| UPDATE PER SECONDS                    | `8 bytes`  |
| PURGE PER SECONDS                     | `8 bytes`  |
| GET PER SECONDS                       | `8 bytes`  |
| SET PER SECONDS                       | `8 bytes`  |
| LIST PER SECONDS                      | `8 bytes`  |
| INFO PER SECONDS                      | `8 bytes`  |
| STATS PER SECONDS                     | `8 bytes`  |
| STAT PER SECONDS                      | `8 bytes`  |
| SUBSCRIBE PER SECONDS                 | `8 bytes`  |
| UNSUBSCRIBE PER SECONDS               | `8 bytes`  |
| PUBLISH PER SECONDS                   | `8 bytes`  |
| HIGHEST PUBLISH PAYLOAD               | `8 bytes`  |
| AVERAGE PUBLISH PAYLOAD               | `8 bytes`  |
| IN BYTES PER SECONDS                  | `8 bytes`  |
| OUT BYTES PER SECONDS                 | `8 bytes`  |
| NUMBER OF KEYS                        | `8 bytes`  |
| NUMBER OF COUNTERS                    | `8 bytes`  |
| NUMBER OF BUFFERS                     | `8 bytes`  |
| NUMBER OF ALLOCATED BYTES ON COUNTERS | `8 bytes`  |
| NUMBER OF ALLOCATED BYTES ON BUFFERS  | `8 bytes`  |
| NUMBER OF CHANNELS                    | `8 bytes`  |
| NUMBER OF SUBSCRIPTIONS               | `8 bytes`  |
| RUNNING SINCE                         | `8 bytes`  |
| NUMBER OF CONNECTIONS                 | `4 bytes`  |
| VERSION                               | `16 bytes` |


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
| READS PER SECOND  | `8 bytes` |
| WRITES PER SECOND | `8 bytes` |
| TOTAL READS       | `8 bytes` |
| TOTAL WRITES      | `8 bytes` |

#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [
  0x09 0x05 0x07 0x07 0x07 0x07 0x07
];

// Explain the buffer ...
explain(buffer);

================================================
== Buffer: 0x09 0x05 0x07 0x07 0x07 0x07 0x07 ==
================================================

===================================================
== Request Type: 0x09             => STAT        ==
== Length(Key): 0x05              => 5           ==
== Key: 0x07 0x07 0x07 0x07 0x07  => bytes       ==
===================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv(33)

// Explain the head response ...
explain(response);

===============================================================================
== Status: 0x01                                                => success    ==
== Reads Per Second: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00   => 1          ==
== Writes Per Second: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00  => 1          ==
== Total Reads: 0x09 0x00 0x00 0x00 0x00 0x00 0x00 0x00        => 9          ==
== Total Writes: 0x08 0x00 0x00 0x00 0x00 0x00 0x00 0x00       => 8          ==
===============================================================================
```

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
| READS PER SECOND  | `8 bytes` |
| WRITES PER SECOND | `8 bytes` |
| TOTAL READS       | `8 bytes` |
| TOTAL WRITES      | `8 bytes` |

> `N` represent `value_type` length.

At the end of the fragment we are going receive the keys in `R bytes` (sum of `QL`):

| Field      | Size       |
|------------|------------|
| KEY        | `QL bytes` |


#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [
  0x10
];

// Explain the buffer ...
explain(buffer);

==================
== Buffer: 0x10 ==
==================

===================================================
== Request Type: 0x10             => STATS       ==
===================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv(8)

// Explain the head response ...
explain(response);

=====================================================
== Buffer: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00 ==
=====================================================

=============================================================
== Fragments: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00 => 1 ==
=============================================================

for P = response.fragments; P != 0; P--

  set fragment_response = socket.recv(16)
  
  explain(fragment_response)
   
  =============================================================================================
  == Buffer: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x02 0x00 0x00 0x00 0x00 0x00 0x00 0x00 ==
  =============================================================================================
  
  ========================================================================
  == Fragment: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00             => 1 ==
  == N of Scoped Keys: 0x02 0x00 0x00 0x00 0x00 0x00 0x00 0x00     => 2 ==
  ========================================================================

  set keys_response = socket.recv(fragment_response.keys * 33)
  
  explain(keys_response)
    
  ==============
  == Key N° 1 ==
  ===============================================================================
  == Size Of Key: 0x03                                                 => 3    ==
  == Reads Per Second: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00         => 1    ==
  == Writes Per Second: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00        => 1    ==
  == Total Reads: 0x09 0x00 0x00 0x00 0x00 0x00 0x00 0x00              => 9    ==
  == Total Writes: 0x08 0x00 0x00 0x00 0x00 0x00 0x00 0x00             => 8    ==
  ===============================================================================
  
  ==============
  == Key N° 2 ==
  ===============================================================================
  == Size Of Key: 0x04                                                 => 4    ==
  == Reads Per Second: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00         => 1    ==
  == Writes Per Second: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00        => 1    ==
  == Total Reads: 0x09 0x00 0x00 0x00 0x00 0x00 0x00 0x00              => 9    ==
  == Total Writes: 0x08 0x00 0x00 0x00 0x00 0x00 0x00 0x00             => 8    ==
  ===============================================================================

  set pending_bytes = 0;

  for each keys_response.items as item
  
    set key_response = socket.recv(item.size_of_key)
    
    explain(key_response)

    // 1st iteration:

    ============================
    == Buffer: 0x61 0x62 0x63 ==
    ============================
    
    ==============
    == Key N° 1 ==
    ================================
    == Key: 0x61 0x62 0x63 => abc ==
    ================================
    
    // 2nd iteration: 
    
    =================================
    == Buffer: 0x45 0x48 0x4C 0x4F ==
    =================================
    
    ==============
    == Key N° 2 ==
    ======================================
    == Key: 0x45 0x48 0x4C 0x4F => EHLO ==
    ======================================
```

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

#### How to use

```Algorithm
// Built the buffer.
set buffer = [
  0x11
  0x05 
  0x07 0x07 0x07 0x07 0x07
];

// Explain the buffer ...
explain(buffer);

================================================
== Buffer: 0x11 0x05 0x07 0x07 0x07 0x07 0x07 ==
================================================

===================================================
== Request Type: 0x11             => SUBSCRIBE   ==
== Length(Key): 0x05              => 5           ==
== Key: 0x07 0x07 0x07 0x07 0x07  => bytes       ==
===================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv()

// Explain the response ...
explain(response);

// If the client was subscribed ...

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

#### How to use

```Algorithm
// Built the buffer.
set buffer = [
  0x12
  0x05 
  0x07 0x07 0x07 0x07 0x07
];

// Explain the buffer ...
explain(buffer);

================================================
== Buffer: 0x12 0x05 0x07 0x07 0x07 0x07 0x07 ==
================================================

===================================================
== Request Type: 0x12             => UNSUBSCRIBE ==
== Length(Key): 0x05              => 5           ==
== Key: 0x07 0x07 0x07 0x07 0x07  => bytes       ==
===================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv()

// Explain the response ...
explain(response);

// If the client was unsubscribed ...

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

### PUBLISH

This request can send a buffer to a subscribed `channel`.

#### Required fields

##### Request type

The first `byte` must be `0x13`.

##### Size of channel

Is the quantity of chars (`M`) used by the key. Contained in `1 byte`.

##### Size of payload

Is the quantity of chars (`O`) used by the payload. Contained in `N bytes`.

##### Channel

Is the name of the channel. Contained in `M bytes`.

##### Payload

Is the payload. Contained in `O bytes`.

#### Response

This server resolve this request by sending `1 byte` response.

The client will receive `0x01` on success or `0x00` on failure.

#### How to use

```Algorithm
// Built the buffer.
set buffer = [
  0x13
  0x05 
  0x07 0x07 0x07 0x07 0x07
  0x05 
  0x03 0x03 0x03 0x03 0x03
];

// Explain the buffer ...
explain(buffer);

=======================================================
== Request Type: 0x13                 => PUBLISH     ==
== Length(Key): 0x05                  => 5           ==
== Length(Payload): 0x05              => 5           ==
== Key: 0x07 0x07 0x07 0x07 0x07      => bytes       ==
== Payload: 0x03 0x03 0x03 0x03 0x03  => bytes       ==
=======================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv()

// Explain the response ...
explain(response);

// If the message was published ...

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

| Field                | Size       |
|----------------------|------------|
| ID                   | `16 bytes` |
| IP VERSION           | `1 byte`   |
| IP                   | `16 bytes` |
| PORT                 | `2 byte`   |
| READ BYTES           | `8 bytes`  |
| WRITE BYTES          | `8 bytes`  |
| PUBLISHED BYTES      | `8 bytes`  |
| RECEIVED BYTES       | `8 bytes`  |
| ALLOCATED BYTES      | `8 bytes`  |
| CONSUMED BYTES       | `8 bytes`  |
| CONNECTED AT         | `8 bytes`  |
| INSERT REQUESTS      | `8 bytes`  |
| SET REQUESTS         | `8 bytes`  |
| QUERY REQUESTS       | `8 bytes`  |
| GET REQUESTS         | `8 bytes`  |
| UPDATE REQUESTS      | `8 bytes`  |
| PURGE REQUESTS       | `8 bytes`  |
| LIST REQUESTS        | `8 bytes`  |
| INFO REQUESTS        | `8 bytes`  |
| STAT REQUESTS        | `8 bytes`  |
| STATS REQUESTS       | `8 bytes`  |
| SUBSCRIBE REQUESTS   | `8 bytes`  |
| UNSUBSCRIBE REQUESTS | `8 bytes`  |
| PUBLISH REQUESTS     | `8 bytes`  |
| CONNECTIONS REQUESTS | `8 bytes`  |
| CONNECTION REQUESTS  | `8 bytes`  |
| CHANNELS REQUESTS    | `8 bytes`  |
| CHANNEL REQUESTS     | `8 bytes`  |
| WHOAMI REQUESTS      | `8 bytes`  |

#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [
  0x14
];

// Explain the buffer ...
explain(buffer);

==================
== Buffer: 0x14 ==
==================

===================================================
== Request Type: 0x14      => CONNECTIONS        ==
===================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv(8)

// Explain the head response ...
explain(response);

=====================================================
== Buffer: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00 ==
=====================================================

=============================================================
== Fragments: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00 => 1 ==
=============================================================

for P = response.fragments; P != 0; P--

  set fragment_response = socket.recv(16)
  
  explain(fragment_response)
   
  ===============================================================================
  == Fragment: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00                    => 1 ==
  == N of Scoped Connections: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00     => 1 ==
  ===============================================================================

  set connections_response = socket.recv(fragment_response.keys * 235)
  
  explain(connections_response)
  
  =====================
  == Connection N° 1 ==
  ==================================================================================================================================
  == ID: 0x4F 0x26 0xE7 0xE7 0x55 0xA6 0x4C 0x75 0xB0 0xE6 0x9E 0x18 0xB1 0x8B 0x2A 0x86  => 4f26e7a7-55a6-4c75-b0e6-9e18b18b2a86 ==
  == IP version: 0x04                                                                     => ipv4                                 ==
  == IP: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00  => 0.0.0.0                              ==
  == Port: 0x28 0x23                                                                      => 9000                                 ==
  == Read Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                  => 0                                    ==
  == Write Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                 => 0                                    ==
  == Published Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                             => 0                                    ==                 
  == Received Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                              => 0                                    ==
  == Allocated Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                             => 0                                    ==
  == Consumed Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                              => 0                                    ==
  == Connected At: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                => 0                                    ==
  == Insert Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                             => 0                                    ==
  == Set Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                => 0                                    ==
  == Query Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                              => 0                                    ==
  == Get Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                => 0                                    ==
  == Update Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                             => 0                                    ==
  == Purge Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                              => 0                                    ==
  == List Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                               => 0                                    ==
  == Info Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                               => 0                                    ==
  == Stat Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                               => 0                                    ==
  == Stats Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                              => 0                                    ==
  == Subscribe Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                          => 0                                    ==
  == Unsubscribe Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                        => 0                                    ==
  == Publish Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                            => 0                                    ==
  == Connections Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                        => 0                                    ==
  == Connection Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                         => 0                                    ==
  == Channels Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                           => 0                                    ==
  == Channel Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                            => 0                                    ==
  == Whoami Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                             => 0                                    ==
  ==================================================================================================================================
```


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

| Field                | Size       |
|----------------------|------------|
| ID                   | `16 bytes` |
| IP VERSION           | `1 byte`   |
| IP                   | `16 bytes` |
| PORT                 | `2 byte`   |
| READ BYTES           | `8 bytes`  |
| WRITE BYTES          | `8 bytes`  |
| PUBLISHED BYTES      | `8 bytes`  |
| RECEIVED BYTES       | `8 bytes`  |
| ALLOCATED BYTES      | `8 bytes`  |
| CONSUMED BYTES       | `8 bytes`  |
| CONNECTED AT         | `8 bytes`  |
| INSERT REQUESTS      | `8 bytes`  |
| SET REQUESTS         | `8 bytes`  |
| QUERY REQUESTS       | `8 bytes`  |
| GET REQUESTS         | `8 bytes`  |
| UPDATE REQUESTS      | `8 bytes`  |
| PURGE REQUESTS       | `8 bytes`  |
| LIST REQUESTS        | `8 bytes`  |
| INFO REQUESTS        | `8 bytes`  |
| STAT REQUESTS        | `8 bytes`  |
| STATS REQUESTS       | `8 bytes`  |
| SUBSCRIBE REQUESTS   | `8 bytes`  |
| UNSUBSCRIBE REQUESTS | `8 bytes`  |
| PUBLISH REQUESTS     | `8 bytes`  |
| CONNECTIONS REQUESTS | `8 bytes`  |
| CONNECTION REQUESTS  | `8 bytes`  |
| CHANNELS REQUESTS    | `8 bytes`  |
| CHANNEL REQUESTS     | `8 bytes`  |
| WHOAMI REQUESTS      | `8 bytes`  |

#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [
  0x15
  0x01 0x00 0x00 0x00
];

// Explain the buffer ...
explain(buffer);

==================
== Buffer: 0x15 0x01 0x00 0x00 0x00 ==
==================

==================================================================
== Request Type: 0x15                     => CONNECTIONS        ==
== Request Type: 0x01 0x00 0x00 0x00      => INDEX              ==
==================================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv(1)


if response.success

  set connection_response = socket.recv(235)

  explain(connection_response)
  
  ================
  == Connection ==
  ==================================================================================================================================
  == ID: 0x4F 0x26 0xE7 0xE7 0x55 0xA6 0x4C 0x75 0xB0 0xE6 0x9E 0x18 0xB1 0x8B 0x2A 0x86  => 4f26e7a7-55a6-4c75-b0e6-9e18b18b2a86 ==
  == IP version: 0x04                                                                     => ipv4                                 ==
  == IP: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00  => 0.0.0.0                              ==
  == Port: 0x28 0x23                                                                      => 9000                                 ==
  == Read Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                  => 0                                    ==
  == Write Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                 => 0                                    ==
  == Published Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                             => 0                                    ==
  == Received Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                              => 0                                    ==
  == Allocated Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                             => 0                                    ==
  == Consumed Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                              => 0                                    ==
  == Connected At: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                => 0                                    ==
  == Insert Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                             => 0                                    ==
  == Set Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                => 0                                    ==
  == Query Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                              => 0                                    ==
  == Get Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                => 0                                    ==
  == Update Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                             => 0                                    ==
  == Purge Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                              => 0                                    ==
  == List Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                               => 0                                    ==
  == Info Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                               => 0                                    ==
  == Stat Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                               => 0                                    ==
  == Stats Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                              => 0                                    ==
  == Subscribe Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                          => 0                                    ==
  == Unsubscribe Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                        => 0                                    ==
  == Publish Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                            => 0                                    ==
  == Connections Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                        => 0                                    ==
  == Connection Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                         => 0                                    ==
  == Channels Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                           => 0                                    ==
  == Channel Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                            => 0                                    ==
  == Whoami Requests: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                             => 0                                    ==
  ==================================================================================================================================
```

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

#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [
  0x16
];

// Explain the buffer ...
explain(buffer);

==================
== Buffer: 0x16 ==
==================

===================================================
== Request Type: 0x16      => CHANNELS           ==
===================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv(8)

// Explain the head response ...
explain(response);

=====================================================
== Buffer: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00 ==
=====================================================

=============================================================
== Fragments: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00 => 1 ==
=============================================================

for P = response.fragments; P != 0; P--

  set fragment_response = socket.recv(16)
  
  explain(fragment_response)
   
  ===============================================================================
  == Fragment: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00                    => 1 ==
  == N of Scoped Channels: 0x01 0x00 0x00 0x00 0x00 0x00 0x00 0x00     => 1 ==
  ===============================================================================

  set channels_response = socket.recv(fragment_response.keys * 21)
  
  explain(channels_response)
  
  =====================
  == Channel N° 1 ==
  ===========================================================================
  == Size of Channel: 0x03                                   => 3          ==
  == Read Bytes: 0x05 0x00 0x00 0x00 0x00 0x00 0x00 0x00     => 5 bytes    ==
  == Write Bytes: 0x07 0x00 0x00 0x00 0x00 0x00 0x00 0x00    => 7 bytes    ==
  == Subscribed Connections: 0x03 0x00 0x00 0x00             => 3          ==
  ===========================================================================
  
  set pending_bytes = 0;

  for each channels_response.items as item
  
    set channel_response = socket.recv(item.size_of_channel)
    
    explain(channel_response)

    ============================
    == Buffer: 0x61 0x62 0x63 ==
    ============================
    
    ==================
    == Channel N° 1 ==
    ================================
    == Key: 0x61 0x62 0x63 => abc ==
    ================================
```


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
| NUMBER OF SUBSCRIBERS (Q) | `4 bytes` |

Per `Q` we need to read `28 bytes`:

| Field         | Size       |
|---------------|------------|
| CONNECTION ID | `16 bytes` |
| SUBSCRIBED_AT | `8 bytes`  |
| READ BYTES    | `8 bytes`  |
| WRITE BYTES   | `8 bytes`  |

#### How to use

```Algorithm
// Define the uint16 as dynamic size.
using size uint16;

// Built the buffer.
set buffer = [
  0x17 0x05 0x07 0x07 0x07 0x07 0x07
];

// Explain the buffer ...
explain(buffer);

================================================
== Buffer: 0x17 0x05 0x07 0x07 0x07 0x07 0x07 ==
================================================

===================================================
== Request Type: 0x17             => CHANNEL     ==
== Length(Channel): 0x05          => 5           ==
== Key: 0x07 0x07 0x07 0x07 0x07  => bytes       ==
===================================================

// Write on socket.
socket.send(buffer);

// Read from socket.
set response = socket.recv(4)

// Explain the head response ...
explain(response);

===============================================================
== Status: 0x01                                => success    ==
== Number of Connections: 0x01 0x00 0x00 0x00  => 1          ==
===============================================================

for P = response.number_of_connections; P != 0; P--
  
    set channel_response = socket.recv(40)
    
    explain(channel_response)
    
    =============================================================================================================================================
    == Connection ID: 0x4F 0x26 0xE7 0xE7 0x55 0xA6 0x4C 0x75 0xB0 0xE6 0x9E 0x18 0xB1 0x8B 0x2A 0x86  => 4f26e7a7-55a6-4c75-b0e6-9e18b18b2a86 ==
    == Subscribed At: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                          => 0                                    ==
    == Read Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                             => 0                                    ==
    == Write Bytes: 0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00                                            => 0                                    ==
    =============================================================================================================================================
```

### WHOAMI

This request can provide the index of the current connection.

#### Required fields

##### Request type

The first `byte` must be `0x18`.

#### Response

This server resolve this request, by sending the connection ID in `16 bytes`.