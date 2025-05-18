# About Server

## Introduction

The Throttr Server is a high-performance TCP server designed to process binary requests using the custom Throttr Protocol. It is implemented entirely in C++ and relies on Boost.Asio for non-blocking I/O operations, making it capable of handling thousands of concurrent clients without allocating one thread per connection.

If you're interested in architecture-level design, systems performance, or low-level networking, this article is for you.

All the source code is available under the [official GitHub repository][].

## Definitions

This section defines the internal components and abstractions used throughout the Throttr Server codebase. Each concept listed here is a direct representation of a class, structure or pattern found in the code. Understanding these terms is key to grasping the flow of control, memory usage, and asynchronous behavior of the server.

### Asio

Asio (Asynchronous I/O) is a C++ library designed for non-blocking I/O operations. The Throttr Server uses Boost.Asio (version 1.87.0) to handle all its TCP communications efficiently, enabling it to scale to many simultaneous clients without needing one thread per connection. Asio provides the foundational layer upon which all network logic in the server is built.

### Server

The `server` class is responsible for listening on a configurable TCP port and accepting new incoming connections. Internally, it holds a `boost::asio::ip::tcp::acceptor` bound to a socket and a port. When a valid connection is received, it constructs a new `session` object to handle that client, and immediately re-arms the acceptor asynchronously to continue accepting new clients.

### Acceptor

The `acceptor` is a Boost.Asio component (`boost::asio::ip::tcp::acceptor`) responsible for binding to a port and receiving new TCP connections. In Throttr, the acceptor is encapsulated inside the `server` and used to spawn `session` objects upon every accepted connection.

### Session

A `session` represents an active TCP connection with a client. It reads incoming binary messages from the socket, decodes them using the Throttr Protocol, routes them to the `state` component for processing, and sends back binary responses. Each session uses a circular buffer to manage incoming data and a write queue (`write_queue_`) to group and dispatch responses asynchronously using `boost::asio::async_write`.

### Buffer

The `buffer` in Throttr is a fixed-size 4096-byte array (`std::array<std::byte, 4096>`) used to temporarily store incoming data from the socket. Two pointers (`buffer_start_`, `buffer_end_`) define the valid region within the buffer. When fragmentation occurs, a compacting process using `memmove` is executed to maintain a contiguous memory region, reducing memory overhead and avoiding unnecessary reallocations.

### IO Context

The `io_context` is the core engine of Asio’s asynchronous system. It dispatches I/O operations and executes registered handlers. Every asynchronous operation in Throttr passes through an `io_context`, allowing multiple connections to be multiplexed over a shared pool of threads.

### Storage

The `storage_` component represents the in-memory data layer of the server. It uses Boost.MultiIndex to store and query entries based on key and expiration time. It manages records efficiently, allowing the system to handle quotas, TTL, and key-value storage without requiring external persistence.

### Chrono

The `chrono` library from the C++ standard library is used to manage time in Throttr. It handles all TTL calculations, expiration scheduling, and time comparisons with nanosecond precision. Time is critical for enforcing rate limits and purging expired entries deterministically.

### Request

A `Request` is the decoded, internal representation of a binary message sent by a client. Each request contains typed fields (like TTL, key, or quota) and is mapped from raw bytes using strict bounds checks followed by reinterpretation (`reinterpret_cast`). Once decoded, a request is routed to the corresponding handler inside `state`.

### Response

A `Response` is the structure generated after processing a request. It may include a status code, TTL, buffer data, or quota value depending on the request type. Responses are serialized into a binary format and pushed into the session’s write queue. They are then sent over the wire using `async_write`.

### State

The `state` class is the core logic unit of the server. It handles request processing, owns the `storage_` container, and manages expiration events. It implements all protocol operations: `insert`, `set`, `get`, `query`, `update`, and `purge`. Each operation is strictly typed and bound to the binary structure defined in the protocol.

The class also owns an `asio::strand` to enforce serialized access to critical sections, and a `steady_timer` used to trigger expiration cleanup at the right moment.

### Scheduler

The Scheduler is the internal mechanism that purges expired records. It is implemented via a `steady_timer` which reschedules itself automatically based on the expiration time of the next item in the `tag_by_expiration` index. When triggered, it marks entries as expired and eventually removes them from memory, ensuring consistency and memory hygiene.

The scheduler runs on the `strand_` context, ensuring race-free execution and allowing the server to support millions of entries with minimal overhead.

### Binary Reinterpretation

Throttr does not parse. It reinterprets.

When a binary message is received, the server does not iterate over bytes or copy data into temporary structures. Instead, it first verifies that the complete expected message is available in the buffer. Once validated, it applies a `reinterpret_cast` directly on the buffer to convert it into the appropriate request structure.

This means numeric fields such as TTL or quota must be encoded in little-endian format. There are no conversions or type checks post-cast: if the message passes the size check, it is assumed valid and directly mapped.

This zero-copy strategy reduces latency and eliminates overhead. The protocol design avoids dynamic parsing logic entirely—validation happens *before* reinterpretation. After that, it's raw pointer logic at maximum speed.

## Components

This section describes the key architectural components that form the Throttr Server runtime. Each part contributes to the server's ability to accept, process, and respond to high-volume binary requests in a non-blocking, event-driven model.

### IO Context and Threads

The `boost::asio::io_context` is the core event loop responsible for dispatching all asynchronous I/O operations in the server. It is created with an internal thread pool size defined by the `--threads` command-line argument or the `THREADS` environment variable.

Each thread calls `.run()` on the same `io_context`, allowing it to concurrently handle multiple socket operations while remaining fully asynchronous.

This design enables high throughput with minimal context switching overhead and no blocking threads, unless explicitly introduced by system calls or bad design.

**Key points:**

- One `io_context` instance serves the entire server.
- Threads are launched using `std::jthread` to automatically handle joining.
- The main thread also calls `.run()` to participate in the work.

### Listener and Acceptor

The `server` class encapsulates a `boost::asio::ip::tcp::acceptor`, which is bound to a user-defined port at startup.

When a new TCP connection arrives:

1. The server asynchronously accepts it using `async_accept()`.
2. A new `session` instance is created using the accepted socket.
3. The acceptor immediately re-arms itself to wait for the next connection.

This loop is fully non-blocking and ensures that the server can handle thousands of simultaneous connections without delay.

**Snippet:**

```cpp
acceptor_.async_accept(socket_, [this](const auto& error) {
    if (!error) {
        std::make_shared<session>(std::move(socket_), state_)->start();
    }
    do_accept(); // continue listening
});
```

### Session Lifecycle

Each `session` handles one TCP connection and is responsible for the full lifecycle of that connection: reading data, decoding messages, processing them, and writing responses.

Sessions live independently and are reference-counted via `std::shared_ptr`.

#### Connection Setup

Upon creation, a session configures the socket with `TCP_NODELAY` to disable Nagle’s algorithm and reduce latency. It also stores the client IP and port for debugging/logging purposes (only in debug builds).

Then it immediately starts the reading cycle with `do_read()`.

#### Reading and Processing

Incoming data is read into a circular buffer of 4096 bytes. The session tracks the valid region of the buffer using two pointers: `buffer_start_` and `buffer_end_`.

When new data arrives:

1. The read handler updates `buffer_end_`.
2. The method `try_process_next()` is called to extract as many full messages as possible.
3. For each complete message:
    - Its size is computed via `get_message_size()`.
    - A span over the message is passed to the corresponding handler in `state`.
    - The handler returns a response object which is queued for writing.

The buffer is compacted using `memmove()` when necessary.

#### Writing and Queuing

Responses are queued in `write_queue_`, a FIFO structure containing `response_holder` objects.

When `do_write()` is called:

1. All buffered responses are transformed into a batch of `boost::asio::const_buffer`.
2. `async_write()` is called with this batch.
3. Once the write completes, the queue is cleared and `do_read()` resumes.

A custom allocator (`handler_allocator`) is used to minimize heap allocations for small handlers by reusing a preallocated 16-byte region.

**Snippet:**

```cpp
boost::asio::async_write(
    socket_,
    buffer_batch,
    boost::asio::bind_allocator(
        handler_allocator<int>(handler_memory_),
        [self](const auto& ec, std::size_t) { self->on_write(ec); }
    )
);
```

## Request Routing

Each `session` is responsible for identifying the request type and forwarding it to the appropriate handler in the `state` component. This is done by inspecting the first byte of the received message buffer, which corresponds to the `request_types` enum.

Once the type is known, the buffer is passed to a strongly typed handler:

- `INSERT` → `handle_insert(std::span<const std::byte>)`
- `SET` → `handle_set(std::span<const std::byte>)`
- `QUERY / GET` → `handle_query(request_query, bool)`
- `UPDATE` → `handle_update(request_update)`
- `PURGE` → `handle_purge(request_purge)`

The routing is done via a `switch` block using `reinterpret_cast`-backed structures only after validating the full buffer size.

**Snippet:**

```cpp
switch (type) {
    case request_types::insert:
        response = state_->handle_insert(buffer);
        break;
    case request_types::set:
        response = state_->handle_set(buffer);
        break;
    case request_types::query:
    case request_types::get:
        response = state_->handle_query(request_query::from_buffer(buffer), type == query);
        break;
    case request_types::update:
        response = state_->handle_update(request_update::from_buffer(buffer));
        break;
    case request_types::purge:
        response = state_->handle_purge(request_purge::from_buffer(buffer));
        break;
}
```

All responses are returned as `std::shared_ptr<response_holder>` objects ready to be queued for writing.

---

## State and Memory

The `state` class implements the core logic of Throttr and is responsible for:

- Request processing
- In-memory storage (`storage_`)
- TTL management and expiration
- Coordinated access via strands

### Storage System

The storage layer is built on top of `boost::multi_index_container`, with two indexes:

- `tag_by_key_and_valid`: a hashed index that allows fast lookup of active entries.
- `tag_by_expiration`: an ordered index used for efficient TTL expiration scanning.

Records are stored as `entry_wrapper` structures containing the key, value, TTL type, and expiration timestamp.

**Example insert:**

```cpp
storage_.insert(entry_wrapper{binary_key, request_entry{...}});
```

### Expiration System

The expiration mechanism is driven by a `boost::asio::steady_timer` that schedules garbage collection when the next entry is about to expire.

1. The earliest expiration is determined via `tag_by_expiration`.
2. The `steady_timer` is armed to trigger at that exact moment.
3. When triggered, expired entries are marked and/or erased.
4. The timer re-arms itself for the next one.

All expiration logic runs inside the `asio::strand` to avoid race conditions.

**Snippet:**

```cpp
expiration_timer_.expires_after(delay);
expiration_timer_.async_wait([self](auto ec) {
    if (!ec) self->expiration_timer();
});
```

### TTL and Quota Handling

The `state` class provides two internal functions to modify records:

- `apply_ttl_change(...)`: adjusts the `expires_at_` value based on the TTL change type.
- `apply_quota_change(...)`: modifies the internal `value_` of a counter entry, depending on `patch`, `increase`, or `decrease`.

TTL values are recalculated from `std::chrono::steady_clock::now()`, and re-scheduling occurs if the modified key is currently active in the scheduler.

Modifications are applied only if the record exists and matches the expected entry type (`counter` or `raw`).

## Memory Optimization

Throttr is designed for high-performance operation with minimal memory churn and zero-copy principles wherever possible. This section outlines the strategies used to reduce heap allocations and maintain efficient runtime behavior.

### Handler Allocator

The `handler_memory` and `handler_allocator<T>` classes work together to optimize memory usage in Asio’s async handlers.

When Asio launches a lambda (such as a read or write callback), it normally allocates memory on the heap. Throttr overrides this behavior by injecting a tiny preallocated buffer (16 bytes) through a custom allocator. If the handler fits within this space, it avoids dynamic memory altogether.

**Benefits:**

- Reduces pressure on the heap allocator.
- Avoids per-handler `new` and `delete`.
- Increases CPU cache locality.

**How it works:**

- If the memory is not in use and the size fits, the pointer to `storage_` is returned.
- Otherwise, fallback to default heap allocation.

```cpp
void* allocate(std::size_t size) {
    if (!in_use_ && size < sizeof(storage_)) {
        in_use_ = true;
        return &storage_;
    }
    return ::operator new(size);
}
```

The deallocation logic restores the buffer if it was used.

### Buffer Management

The read buffer is implemented as a ring-like fixed array of 4096 bytes. Instead of copying every read into a new container, the session uses a pair of pointers (`buffer_start_` and `buffer_end_`) to track the valid segment.

If space runs out:

- If all data was read and processed, the buffer is reset.
- If partial data remains, it is compacted to the beginning via `std::memmove()`.

This keeps the memory model simple, avoids fragmentation, and ensures alignment for the `reinterpret_cast` operations on protocol structs.

## Configuration and Entry Point

### main.cpp

The entry point of the server is defined in `main.cpp`, which handles CLI parsing and environment variable resolution. The available options are:

- `--port`: sets the listening TCP port (default: `9000`).
- `--threads`: number of threads to run (default: `1`, or read from `THREADS` env var).

**Snippet:**

```cpp
_options.add_options()
    ("port", value<short>()->default_value(9000), "Assigned port.")
    ("threads", value<int>()->default_value(default_threads), "Assigned threads.");
```

After parsing:

1. A new `app` instance is created using the given config.
2. The call to `.serve()` initializes the `server`, spawns the worker threads, and runs the `io_context`.

This layer is intentionally minimal — all actual logic is delegated to the `throttr::app` and its contained components.

---

[official GitHub repository]: https://github.com/throttr/throttr
