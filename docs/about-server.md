# About Server

## Introduction

The Throttr Server is a high-performance TCP server designed to process binary requests using the custom Throttr Protocol. It is implemented entirely in C++ and relies on Boost.Asio for non-blocking I/O operations, making it capable of handling thousands of concurrent clients without allocating one thread per connection.

If you're interested in architecture-level design, systems performance, or low-level networking, this article is for you.

All the source code is available under the [official GitHub repository][].

## Get Started

### Run the Server

There are a different ways to get Throttr Server running.

#### Using Binaries

> We have only binaries for `AMD64` and are not compiled with `architecture optimizations`.

This is the most easy and fast way to get an instance ready to accept connections and handle requests.

The first step is go to the [Throttr Releases][].

![Assets per release](/images/releases.png)

Download and extract it. You can run it by using the following command:

```bash
./throttr --port=9000 --threads=4
```

The command parameters are:

- `--socket=/srv/throttr.sock` to define `unix` socket directory and file.
- `--port=9000` to define `tcp` port used by the listener.
- `--threads=2` to define `concurrent` threads used by server.
- `--persistent=true` to enable `persistent` keys on the server. `unstable`.
- `--dump=/srv/throttr.db` to define `dump` file. `unstable`.

#### Using Docker and Docker Compose

This is the most easy and fast way to get an instance running:

##### Steps

###### 1. Define your architecture: 

Are you using `amd64` or `arm64`? If you're using some of them, you'll be able to use throttr.

Consider your architecture as `A`. IE: `A = amd64` or `A = arm64`.

###### 2. Define your `counter` and `buffers` size. 

Consider `V` as size. 

If your `quota` or `buffer` length is ...

- Upto `255` then `V = uint8`.  
- Upto `65,535` then `V = uint16`.  
- Upto `4,294,967,295` then `V = uint32`.  
- Upto `2^64 - 1` then `V = uint64`.  

###### 3. Define your `build` type.

Consider `T` as type.

If you want to have logs then use `debug`.

Otherwise, if you expect maximum performance, use `release`.

###### 4. Define your `metrics` feature flag.

Consider `M` as flag.

If you want to have metrics to measure:

- Network bandwidth usage per `connection` and `channel`.
- Read and writes for `counters` and `buffers`.
- Statistics per request type.

Use `M = enabled`. Otherwise `M = disabled`.

###### 5. Get the instance running.

You can get the instance, using the previous defined variables by using the following `bash` script.

```bash
# Once you define your instance type:

A="amd64"
V="uint16"
T="debug"
M="enabled"

# Pull the image
docker pull ghcr.io/throttr/throttr:5.0.5-${T}-${V}-${A}-metrics-${M}

# Tag locally
docker tag ghcr.io/throttr/throttr:5.0.5-${T}-${V}-${A}-metrics-${M} throttr:local

# Run
docker run -p 9000:9000 throttr:local
```

Or use `Docker Compose`, of course, you should modify them:

```yaml
version: '3.8'

services:
  throttr:
    image: ghcr.io/throttr/throttr:5.0.5-debug-uint16-amd64-metrics-enabled
    ports:
      - "9000:9000"
    container_name: throttr
```

Finally, you can make it run using `docker compose up`.




#### Building from Source

Throttr Server requires:

- Boost 1.87.0

The following guide has been built to `Debian 12`:

```shell
# Update system
apt update

# Install build dependencies
apt-get install -y lsb-release \
                   gnupg \
                   git \
                   wget \
                   build-essential \
                   cmake \
                   gcc \
                   make \
                   apt-utils \
                   zip \
                   unzip \
                   tzdata \
                   libtool \
                   automake \
                   m4 \
                   re2c \
                   curl \
                   supervisor \
                   libssl-dev \
                   zlib1g-dev \
                   libcurl4-gnutls-dev \
                   libprotobuf-dev \
                   python3 \
                   lcov \
                   doxygen \
                   graphviz \
                   rsync \
                   gcovr

# Getting Boost 1.87.0
wget https://archives.boost.io/release/1.87.0/source/boost_1_87_0.tar.gz

# Extract, move and compile
tar -xf boost_1_87_0.tar.gz
cd boost_1_87_0
sh bootstrap.sh --with-libraries=all
./b2 install debug \
             variant=debug \
             debug-symbols=on \
             link=static \
             runtime-link=static \
             --without-python
```

After that, you can clone the repository:

```shell
# Clone the repository
git clone https://github.com/throttr/throttr.git

# Move, build and test
cd throttr
mkdir build
cmake .. -DCMAKE_BUILD_TYPE=Debug -DBUILD_TESTS=ON
make
ctest
```

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

The `state` class is the core logic unit of the server. It handles request processing, owns the `storage_` container, and manages expiration events. It implements all protocol operations. Each operation is strictly typed and bound to the binary structure defined in the protocol.

The class also owns an `asio::strand` to enforce serialized access to critical sections, and a `steady_timer` used to trigger expiration cleanup at the right moment.

### Garbage Collector

The Garbage Collector is responsible for scanning and purging expired records in memory. It is built as a standalone service that interacts with the `state` component and schedules expiration cycles using a `boost::asio::steady_timer`.


### Binary Reinterpretation

Throttr does not parse. It reinterprets.

When a binary message is received, the server does not iterate over bytes or copy data into temporary structures. Instead, it first verifies that the complete expected message is available in the buffer. Once validated, it applies a `reinterpret_cast` directly on the buffer to convert it into the appropriate request structure.

This means numeric fields such as TTL or quota must be encoded in little-endian format. There are no conversions or type checks post-cast: if the message passes the size check, it is assumed valid and directly mapped.

This zero-copy strategy reduces latency and eliminates overhead. The protocol design avoids dynamic parsing logic entirely—validation happens *before* reinterpretation. After that, it's raw pointer logic at maximum speed.

## Project Structure

### Folders

#### The `/src` folder

This folder contains the implementation files of the project. It holds the source code that defines the runtime behavior of the server.

#### The `/src/include/throttr` folder

This directory contains all public headers of the project, organized by functionality. It defines the main interfaces of the server and its internal behavior. Below are its primary subcomponents:

- The `app.hpp` defines the `app` class, which serves as the top-level entry point to the server. It encapsulates the I/O context, manages the number of threads, and holds the shared server state. This class is responsible for starting and stopping the server. It provides two main methods: `serve()`, which initiates the server loop using the configured thread pool, and `stop()`, which halts execution.

- The `state.hpp` file defines the central `state` class, which acts as the orchestrator of the entire server lifecycle. It manages the shared server state, stores connections, subscriptions, metrics, and services. The class is responsible for handling new connections (`join`) and safely removing them (`leave`). It includes critical components like a multi-indexed storage container, expiration and metrics timers, and various service classes to delegate responsibilities like garbage collection, response building, command handling, and subscription tracking. The state class is thread-safe via mutexes and strands, ensuring consistency across asynchronous operations. It also maintains metrics and lifecycle timestamps for advanced observability and analysis.

- The `server.hpp` defines the `server` class, responsible for accepting incoming TCP connections and linking them to the shared server state. It initializes the acceptor on a specified port and triggers the asynchronous accept loop. Each accepted connection is handed off to a `connection` instance. The class encapsulates the networking entry point and ties it to the overall system state.
 
- The `connection.hpp` defines the `connection` class, which manages an individual TCP session. It handles reading from the socket, message parsing, command dispatching, and writing responses. Each connection owns its read buffer, write queue, and holds a reference to the global server `state`. It uses `boost::asio::async_read_some` and `async_write` with custom memory allocators for performance. The `start()` method joins the connection to the global state and initiates the read loop. Incoming bytes are processed via `try_process_next()`, which extracts messages using `get_message_size()` and delegates them to the command handler. Outgoing responses are enqueued with `send()` and dispatched through `write_next()`. Metrics are collected if enabled, and the connection cleans itself up on close.

- The `connection_allocator.hpp` defines a custom allocator system used to optimize memory allocation for asynchronous handlers in the connection class. It includes two key components: `connection_handler_memory`, which provides a small fixed-size buffer for reuse during read/write operations, and `connection_handler_allocator<T>`, a template-compatible allocator that wraps around the handler memory. This mechanism reduces dynamic memory allocations by reusing stack-like storage for small lambda captures inside Asio’s `async_read_some` and `async_write`. It is particularly useful for high-throughput scenarios, minimizing heap pressure and improving cache locality during TCP operations.

- The `connection_metrics.hpp` defines the metrics structures used to monitor network and memory activity for each TCP connection, available only when the `ENABLED_FEATURE_METRICS` flag is active. It includes `connection_network_metrics` to track bytes read, written, published, and received; `connection_memory_metrics` to monitor memory usage; and `connection_metrics`, which aggregates all of these along with per-command metrics in a fixed-size array. These structures enable fine-grained observability of each connection's behavior, facilitating performance tuning and debugging in production environments.

- The `metric.hpp` defines the `metric` structure, used to collect and compute usage statistics such as count, historical accumulation, and per-minute activity. It is only included when `ENABLED_FEATURE_METRICS` is defined. Each metric consists of three atomic counters, providing thread-safe tracking of operations. The `mark()` method registers new events, while `compute()` updates the per-minute summary. This structure supports move and copy semantics and serves as the building block for higher-level metrics tracking in the system.

- The `protocol_wrapper.hpp` defines a compile-time alias `THROTTR_VALUE_SIZE` that determines the size type used for quota and TTL values in the protocol. This alias is conditionally set based on build-time flags such as `THROTTR_VALUE_SIZE_UINT8`, `THROTTR_VALUE_SIZE_UINT16`, etc. It serves as a flexible configuration layer over the core protocol definitions in `protocol.hpp`, allowing the server to adjust value granularity and memory footprint without altering the implementation logic.

- The `storage.hpp` defines the `storage_type`, a multi-index container based on Boost.MultiIndex, used to store and retrieve `entry_wrapper` instances efficiently. It supports hashed access by request key via the `tag_by_key` index. This structure allows fast lookup and management of active requests in the system, serving as a central component for request deduplication, throttling, and expiration logic.

- The `entry_wrapper.hpp` defines the `entry_wrapper` structure, which encapsulates a request's key and its corresponding `request_entry`. It includes an `expired_` flag to mark obsolete entries, and optionally a pointer to `entry_metrics` when metrics are enabled. The key is stored as a `std::vector<std::byte>`, and a method `key()` returns it in the wrapped `request_key` form used by the storage index. This struct is the fundamental unit stored in the multi-index container.

- The `entry_metrics.hpp` defines the `entry_metrics` struct, which tracks usage statistics for a specific request entry. It contains atomic counters for read and write operations, including total accumulators and per-minute rates. This struct is conditionally compiled when metrics are enabled and is used in conjunction with `entry_wrapper` to monitor access patterns and performance.

- The `message.hpp` file defines the `message` class, which encapsulates data for outbound communication. It holds a `write_buffer_` for raw payload bytes and a `buffers_` vector for zero-copy transmission using `boost::asio::const_buffer`. The `recyclable_` flag allows reuse of message instances when appropriate. This structure is shared across the system and designed for efficient asynchronous sending.

- The `subscription.hpp` file defines the `subscription` struct, which links a connection to a specific channel. It stores the `connection_id_` as a UUID, the subscribed `channel_`, and a timestamp `subscribed_at_` in nanoseconds. When metrics are enabled, it also tracks a shared pointer to `subscription_metrics`. This structure is central to the Pub/Sub model within Throttr.

- The `subscription_metrics.hpp` file defines the `subscription_metrics` struct, which captures I/O metrics for individual subscriptions. When metrics are enabled, it tracks `read_bytes_` and `write_bytes_` using the `metric` structure. The class is non-copyable and non-movable to ensure thread safety and prevent accidental duplication of metrics data.

- The `time.hpp` file provides helper functions to calculate expiration points (`get_expiration_point`) and remaining TTL (`get_ttl`) based on the configured time unit (`ttl_types`) and a raw byte span (`std::span<const std::byte>`). It uses `value_type` (defined by `THROTTR_VALUE_SIZE`) to support variable TTL sizes (8, 16, 32, or 64 bits). The byte span is interpreted in little-endian order without relying on `memcpy`, and the resulting duration is added to the current time using `std::chrono`. Both functions are agnostic to time resolution, making them flexible and ready for benchmarking or instrumentation.

- The `utils.hpp` file provides utility functions primarily focused on debugging and logging. It includes hexadecimal conversion helpers such as `buffers_to_hex`, `span_to_hex`, `string_to_hex`, and `id_to_hex`, which turn binary buffers and UUIDs into human-readable hexadecimal strings. These are useful for inspecting raw protocol data. Additionally, the file defines `to_string(...)` overloads for the `ttl_types`, `attribute_types`, and `change_types` enums, enabling readable log output or diagnostics. All functions are inline or static and kept header-only for maximal inlining and minimal overhead.

- The `version.hpp` file defines a single inline function `get_version()`, which returns the current semantic version of the Throttr server as a `std::string_view`. This provides a lightweight, compile-time retrievable identifier of the build version, useful for diagnostics, logging, and compatibility checks between clients and servers. The current version string is `"5.0.2"`.

###### The `services` folder 

- The `commands_service.hpp` defines the `commands_service` class, which acts as a centralized registry and dispatcher for all supported request types in the server. Each command is mapped to a corresponding static function pointer using a fixed-size array of 32 entries. This design ensures constant-time dispatch and avoids dynamic polymorphism overhead. The constructor pre-populates the `commands_` array with default handlers from `base_command::call`, and then overrides each index with the correct handler for supported `request_types`, such as `insert`, `set`, `query`, `update`, `purge`, `list`, `stat`, `subscribe`, `publish`, and others. This structure allows fast, deterministic routing of requests to their proper command logic.

- The `create_service.hpp` defines the static method `create_service::use`, responsible for inserting or setting key-value pairs into the internal state storage. It calculates the expiration time based on the TTL type and value, constructs an `entry_wrapper` containing the key, value, and metadata, and inserts it into the `state->storage_`. If the key is successfully inserted, the method schedules a new garbage collection timer using the earliest non-expired expiration point. It also tracks write and read metrics when metrics are enabled. The logic is performance-aware and designed for low-latency operation with relaxed memory ordering and optimization notes for large datasets.

- The `find_service.hpp` provides two static methods to retrieve entries from the internal storage. The method `find_or_fail` attempts to find a non-expired item by key from the state index, returning a `std::optional<storage_iterator>`. If the item is found and valid, it increments the read metric counter (if enabled) and returns the iterator. The method `find_or_fail_for_batch` wraps this behavior for batch operations, and appends a failure marker (`state::failed_response_`) to the output batch if the key is not found. This service centralizes read path logic and ensures consistent failure handling for both single and batched queries.

- The `garbage_collector_service.hpp` defines the logic for expiration and cleanup of outdated entries. The `schedule_timer` method sets a timer using Boost.Asio that will trigger garbage collection when the next expiration point is reached. The `run` method locks the state, scans all entries for expiration, and either marks them as expired or erases them if they have surpassed a safety margin. After processing, it recalculates the next nearest expiration and reschedules itself accordingly. This service ensures memory and storage integrity without requiring external triggers, running autonomously within the server loop.

- The `messages_service.hpp` defines a central dispatch system for message size evaluation. This service maps each supported request type to a corresponding function that computes the exact size of the incoming payload, based on the binary protocol format. The constructor initializes a fixed-size array of 32 function pointers, each handling a specific request type such as `insert`, `get`, `set`, `publish`, etc. This structure enables fast and predictable parsing of incoming binary data, acting as the first decoding stage before command execution. Invalid or unrecognized types are routed to a default handler returning zero, allowing safe fallback for unknown inputs.

- The `metrics_collector_service.hpp` defines a conditional service (enabled only if `ENABLED_FEATURE_METRICS` is defined) responsible for computing and aggregating per-command metrics. Internally, it maintains an array of 32 `metric` instances—one per command type. Every minute, a timer triggers `run()`, which updates read/write counts for each stored key and invokes `compute()` on every connection’s metric set. This design supports real-time performance visibility and historic accumulation (e.g., per-minute rates and total counters). The `compute_all()` method finalizes the aggregation cycle. All activity is dispatched via `strand_` to ensure thread safety.

- The `messages_service.hpp` defines registers message size-parsing functions for each supported `request_types` enum value. It uses a fixed-size array of 32 function pointers (`message_types_`), each pointing to a function that determines the complete size of a specific request type based on the provided buffer. These functions check the minimum required header size and, when applicable, parse additional fields like key size or value size to return the total expected size of the message. If the buffer is too small or the type is unknown, a fallback function `invalid_size()` returns 0.  This structure supports zero-copy parsing and avoids overreads, which is essential for safely handling partially received or fragmented binary TCP messages. It also enables consistent and centralized message framing logic across all Throttr request types.

- The `subscriptions_service.hpp` defines the `subscriptions_service` class, which manages active client subscriptions to channels. It uses a Boost.MultiIndex container (`subscription_container`) to allow efficient lookups by both `connection_id_` and `channel_`. The class exposes a single method, `is_subscribed()`, that checks whether a given connection ID is already subscribed to a specific channel. This is performed using the `by_connection_id` index and iterating over matching entries. The internal container is protected by a `std::mutex`, allowing thread-safe operations when used correctly. This service supports the internal pub/sub mechanism of Throttr, ensuring efficient tracking of channel listeners.

- The `update_service.hpp` defines the `update_service` class, responsible for applying runtime modifications to storage entries, including quota updates via atomic operations (`patch`, `increase`, `decrease`) and TTL adjustments (`patch`, `increase`, `decrease`) based on the configured unit (`seconds`, `milliseconds`, or `nanoseconds`); it includes logic to reschedule the garbage collector when the updated key matches the scheduled one.

###### The `commands` folder

- The `base_command.hpp` defines the `base_command` class, which acts as the fallback handler for unrecognized or unsupported request types; its static `call()` method is invoked by the `commands_service` when no specialized command is found, and it simply appends a predefined failure response (`state::failed_response_`) to the output batch without performing any processing.

- The `channel_command.hpp` implements the logic for handling `CHANNEL` requests, which query the current state of active subscriptions for a specific channel; when invoked, it looks up the channel in the state's subscription index, and if found, writes the number of matching subscriptions followed by each subscriber’s UUID, subscription timestamp, and traffic metrics (read/write bytes) to the response buffer, otherwise it returns a failure response—this mechanism enables introspection of per-channel activity and is only available when the `ENABLED_FEATURE_METRICS` flag is defined.

- The `channels_command.hpp` handles the `CHANNELS` request, which returns a list of all active channels across the system. If the `ENABLED_FEATURE_METRICS` flag is not defined, the command fails immediately. Otherwise, it delegates response construction to `response_builder_service::handle_fragmented_channels_response`, which serializes the list of channels into the write buffer. This command provides global visibility over the pub/sub topology, useful for observability and monitoring purposes.

- The `connection_command.hpp` handles the `CONNECTION` request, which queries detailed information about a specific connection given its UUID. It parses the request, locks the connection map, and attempts to locate the connection. If found, it responds with `success_response_` and delegates serialization to `write_connections_entry_to_buffer`, excluding internal metrics if the connection is not the sender. If the UUID is unknown, it replies with `failed_response_`. This command enables precise inspection of peer connection states.

- The `connections_command.hpp` handles the `CONNECTIONS` request, which returns a full listing of all active connections in the server. If metrics are disabled (`ENABLED_FEATURE_METRICS` not defined), the server responds immediately with `failed_response_`. Otherwise, it uses `response_builder_service::handle_fragmented_connections_response` to serialize and fragment the response based on the state of all current connections. This allows introspection and monitoring of the system’s connection pool.

- The `info_command.hpp` handles the `INFO` request, producing a compact binary snapshot of the current state of the server. It includes system uptime (epoch seconds), global request statistics (total and per minute), per-command metrics, network I/O (read/write bytes per connection), memory usage (by counters and raw buffers), and Pub/Sub state (channels and subscriptions). At the end, it appends the version string (padded to 16 bytes). This response is intended for system introspection tools or monitoring dashboards and is only serialized if metrics are enabled.

- The `insert_command.hpp` handles creation of a new counter entry, parsed from the binary request using `request_insert::from_buffer`. It delegates the actual insertion to `create_service::use(...)`, passing key, quota, TTL type and TTL. If successful, it appends a single-byte success response to the batch (`0x01`); otherwise, it appends failure (`0x00`). This command is only valid for inserting *counter*-type entries and does not support raw buffer types.

- The `list_command.hpp` streams all stored entries to the client using a fragmenting mechanism. It leverages `response_builder_service::handle_fragmented_entries_response`, which paginates the entries (chunk size = 2048 bytes). Each entry is serialized via `write_list_entry_to_buffer`, allowing structured response construction. Metrics and debug logs are omitted unless `NDEBUG` is undefined. The request body (`view`) is ignored; `LIST` always returns all available keys, regardless of filters or client state.

- The `publish_command.hpp` distributes a message to all subscribers of the specified channel, excluding the sender, by constructing a `message` object with the payload serialized as `0x03 + size (LE) + payload` and dispatching safe copies to each active connection via `state->connections_`.

- The `purge_command.hpp` defines a command that attempts to remove a key from storage if it exists and is not expired, returning either a success or failure response accordingly.

- The `query_command.hpp` defines the logic to retrieve either the value and TTL information for a given key (`QUERY`) or just the TTL and value metadata (`GET`), assembling the response in binary format.

- The `set_command.hpp` file provides the implementation of the `set_command` class, which handles SET requests by storing a key-value pair along with TTL metadata into the server’s internal state, returning a success or failure byte.

- The `stat_command.hpp` file implements the `stat_command` class, responsible for responding to STAT requests with live read/write metrics. If the metrics feature is disabled at compile-time, the command returns a failure response immediately. Otherwise, it extracts counters such as reads/writes per minute and total accumulators, serializes them as 64-bit integers into the write buffer, and appends them to the response batch.

- The `stats_command.hpp` file defines the `stats_command` class, which handles STATS requests by collecting and serializing global statistics for all entries in the system. If the metrics feature is disabled at compile-time, it immediately returns a failure response. Otherwise, it delegates the response construction to `response_builder_service::handle_fragmented_entries_response`, enabling efficient fragmentation and streaming of large data sets.

- The `subscribe_command.hpp` file defines the `subscribe_command` class, which processes SUBSCRIBE requests by registering a connection to a specific channel. The command extracts the channel from the request, acquires a lock on the `subscriptions_` map, and attempts to insert a new subscription entry (`connection_id`, `channel`). A success or failure response is appended to the output batch depending on whether the insertion was successful. The operation is thread-safe and optionally logs the result if debug mode is enabled.

- The `unsubscribe_command.hpp` file defines the `unsubscribe_command` class, which handles UNSUBSCRIBE requests by removing a subscription associated with a connection and a specific channel. It first checks if the connection is actually subscribed to the given channel. If not, it responds with a failure byte. If the subscription exists, it acquires the `by_connection_id` index from the internal subscription multimap, locates all entries tied to the connection, and removes those matching the requested channel. A success byte is appended to the response batch. The process is thread-safe and logs the operation when compiled in debug mode.

- The `update_command.hpp` file defines the `update_command` class, responsible for handling UPDATE requests in Throttr. When invoked, the `call` method parses the incoming buffer to extract the key and requested attribute change (such as `ttl` or `quota`). It locates the corresponding entry using the internal `finder_`, and if found, attempts to apply the modification through the `update_service`. If the modification is successful, a success byte is appended to the response batch; otherwise, a failure byte is returned. Metrics are updated when the `ENABLED_FEATURE_METRICS` flag is active. Debug logs provide detailed tracing of each update operation, including key, change type, and outcome.

- The `whoami_command.hpp` file implements the `whoami_command` class, which handles the WHOAMI request within Throttr. This command is used to identify the current client connection. When invoked, the `call` method adds a success byte to the response and appends the UUID of the connection to the write buffer. The UUID is extracted directly from the `connection` object and returned to the client. This response allows clients to confirm their unique identity within the system. In debug builds, a log entry is generated with a timestamp and the connection UUID that triggered the request.

## About Connections

This section provides a comprehensive breakdown of how connections are handled within the Throttr server. The connection mechanism is designed to be lightweight, asynchronous, and highly efficient, supporting thousands of concurrent clients with minimal memory overhead.

---

### Lifecycle of a Connection

Each incoming TCP client connection is accepted and wrapped inside a `throttr::connection` object. This object encapsulates all connection-specific state, including socket management, buffers, metrics, and message batching.

- **Creation**: When a new socket is accepted, a `connection` is instantiated with a generated UUID and a reference to the shared `state`.
- **Startup**: Upon calling `start()`, the connection logs its metadata and begins the read loop with `do_read()`.

---

### Integration with Global State

Connections are registered into the central `state` via `state_->join(this)` on start, and removed on destruction via `state_->leave(this)`.

The `state` object provides:
- The UUID generator (`id_generator_`)
- Message type parsers (`messages_`)
- Command dispatchers (`commands_`)
- Optional metrics collectors (`metrics_collector_`)

This tight coupling ensures that each connection is context-aware and participates in system-wide tracking and orchestration.

---

### Buffering Model

Each connection maintains an internal fixed-size buffer (`buffer_`, 8096 bytes) and uses two pointers: `buffer_start_` and `buffer_end_` to track the read window.

- Incoming data is written to `buffer_.data() + buffer_end_`.
- After processing a message, `buffer_start_` advances.
- If needed, `compact_buffer_if_needed()` slides unprocessed bytes to the beginning to free space without allocations.

---

### Message Parsing and Execution

Throttr uses a zero-copy, span-based model to decode and dispatch requests:

1. Upon receiving bytes, `try_process_next()` determines if a complete message has been received.
2. The message size is inferred using `get_message_size()`, based on the request type's registered parser.
3. If a full message is present:
   - It is passed to the corresponding command handler.
   - Metrics are updated if enabled.
   - The command populates a `message` object for response.

The same loop continues as long as more complete messages are available in the buffer.

---

### Asynchronous Read & Write

Throttr is fully non-blocking, relying on Boost.Asio’s event-driven model.

#### Reading

- `do_read()` schedules a new `async_read_some()` into the available buffer window.
- On completion, `on_read()` validates the result and passes control to the processing loop.

#### Writing

- Outgoing responses are queued in `pending_writes_`, a FIFO deque.
- `send()` schedules the write via `on_send()`, which triggers `write_next()` if no other write is in progress.
- `on_write()` finalizes the write, optionally recycles the message, and continues the queue.

This design ensures minimal write contention and avoids simultaneous write races.


### Message Recycling

The `message` object used for responses can be reused. If a message is marked `recyclable_`, it is cleared and retained for future use after a successful write.

This mechanism reduces heap allocations and promotes buffer reuse, which is critical in high-throughput systems.


### Metrics Collection

If compiled with `ENABLED_FEATURE_METRICS`, each connection:

- Tracks inbound/outbound byte counts.
- Records command type distribution.
- Updates the global metrics collector (`state_->metrics_collector_`).

This enables deep observability into traffic and usage patterns per connection, per command.

### UUID & Client Identity

Each connection is assigned a unique `boost::uuids::uuid` (`id_`) at creation time. This ID is:

- Exposed via the `WHOAMI` command.
- Used in logs and traces.
- Helps identify and correlate client behavior throughout the system.


### Error Handling & Cleanup

- Read or write errors result in a graceful shutdown via `close()`, which shuts down and closes the socket.
- On destruction, the connection ensures it unregisters from the global state and logs its closure (in debug builds).


## Components

This section describes the key architectural components that form the Throttr Server runtime. Each part contributes to the server's ability to accept, process, and respond to high-volume binary requests in a non-blocking, event-driven model.

### IO Context and Threads

The `boost::asio::io_context` is the core event loop responsible for dispatching all asynchronous I/O operations in the server. It is created with an internal thread pool size defined by the `--threads` command-line argument or the `THREADS` environment variable.

Each thread calls `.run()` on the same `io_context`, allowing it to concurrently handle multiple socket operations while remaining fully asynchronous.

This design enables high throughput with minimal context switching overhead and no blocking threads, unless explicitly introduced by system calls or bad design.

**Key points:**

* One `io_context` instance serves the entire server.
* Threads are launched using `std::jthread` to automatically handle joining.
* The main thread also calls `.run()` to participate in the work.

### Listener and Acceptor

The `listener` class encapsulates a `boost::asio::ip::tcp::acceptor`, which is bound to a user-defined port at startup.

When a new TCP connection arrives:

1. The server asynchronously accepts it using `async_accept()`.
2. A new `connection` instance is created using the accepted socket.
3. The acceptor immediately re-arms itself to wait for the next connection.

This loop is fully non-blocking and ensures that the server can handle thousands of simultaneous connections without delay.

### Session Lifecycle

Each `connection` handles one TCP connection and is responsible for the full lifecycle of that connection: reading data, decoding messages, processing them, and writing responses.

Connections live independently and are reference-counted via `std::shared_ptr`.

#### Reading and Processing

Incoming data is read into a circular buffer of 4096 bytes. The connection tracks the valid region of the buffer using two pointers: `buffer_start_` and `buffer_end_`.

When new data arrives:

1. The read handler updates `buffer_end_`.
2. The method `try_process_next()` is called to extract as many full messages as possible.
3. For each complete message:

   * Its size is computed via `get_message_size()`.
   * A span over the message is passed to the appropriate handler.
   * The handler returns a response object which is queued for writing.

The buffer is compacted using `memmove()` when necessary.

#### Writing and Queuing

Responses are queued in a FIFO structure using `message` instances.

When `do_write()` is called:

1. All buffered responses are transformed into a batch of `boost::asio::const_buffer`.
2. `async_write()` is called with this batch.
3. Once the write completes, the queue is cleared and `do_read()` resumes.

A custom allocator (`connection_handler_allocator`) is used to minimize heap allocations for small handlers by reusing a preallocated region.

### Memory Optimization

Throttr is designed for high-performance operation with minimal memory churn and zero-copy principles wherever possible. This section outlines the strategies used to reduce heap allocations and maintain efficient runtime behavior.

#### Handler Allocator

The `connection_handler_memory` and `connection_handler_allocator<T>` classes work together to optimize memory usage in Asio’s async handlers.

When Asio launches a lambda (such as a read or write callback), it normally allocates memory on the heap. Throttr overrides this behavior by injecting a preallocated buffer through a custom allocator. If the handler fits within this space, it avoids dynamic memory altogether.

**Benefits:**

* Reduces pressure on the heap allocator.
* Avoids per-handler `new` and `delete`.
* Increases CPU cache locality.

#### Buffer Management

The read buffer is implemented as a ring-like fixed array of 4096 bytes. Instead of copying every read into a new container, the connection uses a pair of pointers (`buffer_start_` and `buffer_end_`) to track the valid segment.

If space runs out:

* If all data was read and processed, the buffer is reset.
* If partial data remains, it is compacted to the beginning via `std::memmove()`.

This keeps the memory model simple, avoids fragmentation, and ensures alignment for the `reinterpret_cast` operations on protocol structs.

### Configuration and Entry Point

The entry point of the server is defined in `main.cpp`, which handles CLI parsing and environment variable resolution. The available options are:

* `--port`: sets the listening TCP port (default: `9000`).
* `--threads`: number of threads to run (default: `1`, or read from `THREADS` env var).

After parsing:

1. A new `app` instance is created using the given config.
2. The call to `.serve()` initializes the `listener`, spawns the worker threads, and runs the `io_context`.

This layer is intentionally minimal — all actual logic is delegated to the `throttr::app` and its contained components.

### State

The `state` class is the central coordination unit of the server. It holds and manages all core services, acting as the nexus for command execution, memory management, and connection lifecycle.

#### Responsibilities

- Maintains the registry of all active connections, indexed by UUID.
- Stores the `commands` dispatcher used to resolve and invoke handlers for each `request_type`.
- Holds the `messages` dispatcher responsible for decoding message lengths and payload formats.
- Provides access to the `garbage_collector`, which schedules and purges expired entries.
- Manages the `subscriptions` index and controls lifecycle of publish/subscribe operations.
- Exposes a shared `uuid` generator for connection ID assignment.
- Optionally tracks and exports global `metrics` if the feature is enabled.

#### Design characteristics

- All connections invoke commands through a reference to the shared `state` instance.
- Uses a `strand` to serialize operations on shared memory and ensure thread safety.
- Provides `join()` and `leave()` methods to register and clean up connections.
- Implements a mutex-protected container for the connection map and subscription index.

#### Internals

- Shared services are initialized at construction (`commands`, `finder`, `response_builder`, etc.).
- Optional services (like metrics) are compiled in conditionally.
- Time-based services like the garbage collector and metrics timer are scheduled via `steady_timer` on the shared I/O context.
- The `state` instance is designed to be long-lived and safe for concurrent access across thousands of sessions.

This component embodies the runtime context of the server and acts as the root service container for all logic layers.


### Commands

The `commands` component is responsible for dispatching request logic. Every incoming `request_type` is mapped to a corresponding handler function, which is stored in a fixed-size array `commands_[]`.

#### Responsibilities

- Maps each request type to its logic executor.
- Acts as the execution layer of the protocol.
- Ensures the correct command is invoked based on message decoding.

#### Implementation details

- Internally uses an `std::array<command_callback, 32>` where each index corresponds to a specific `request_type`.
- Each command is a function with the signature:
   - `(shared_ptr<state>, request_types, span<const byte>, write_buffers, write_vector, shared_ptr<connection>)`
- The handler modifies the write buffer using shared memory and prepares a response accordingly.
- All command handlers share a common structure, ensuring predictable and unified behavior.
- Unrecognized or disabled commands fallback to `base_command::call`.

#### Efficiency notes

- Commands are executed without virtual dispatch or runtime allocations.
- The fixed array ensures O(1) access time.
- All handlers operate directly on preallocated memory buffers.
- This architecture enables high-throughput command processing with minimal overhead.

This component defines the behavioral core of the server by implementing each supported operation (insert, update, set, publish, etc.) in its own dedicated command unit.

### Messages

The `messages` component defines the logic for resolving message sizes dynamically from raw input buffers. It enables zero-copy parsing by determining the exact byte length required to consider a message "complete" for a given `request_type`.

#### Responsibilities

- Maps each `request_type` to a function capable of calculating the required byte size for that type.
- Enables early validation before dispatching commands, ensuring that the connection has received enough bytes.
- Allows the system to process incoming binary streams efficiently, without reallocations or temporary copies.

#### Implementation details

- The internal array `message_types_[]` holds one function pointer per possible message type (`std::array<size_callback, 32>`).
- Each callback receives a `std::span<const std::byte>` and returns the full expected size of the corresponding message.
- All functions perform minimal checks (usually validating size headers and extracting key lengths or payload sizes).
- For complex message types (e.g., `set`, `publish`, `update`), the functions parse specific byte positions to extract field lengths and compute total size.
- Incomplete messages return `0`, indicating that the parser should wait for more bytes.

#### Efficiency notes

- No heap allocation or data copying occurs during size resolution.
- Size functions avoid unnecessary branching and rely on fixed offset arithmetic.
- Designed for ultra-low-latency processing of streaming TCP data, especially under high-throughput conditions.

This component ensures that each message is parsed only when it's fully available, which is critical for a binary protocol system operating at scale.

### Metrics Collector

The metrics collector component is available only if `ENABLED_FEATURE_METRICS` is defined. It tracks the number of reads, writes, and processed commands.

Each connection may also have its own `connection_metrics` object for per-session statistics. The collector supports real-time observability and post-analysis of traffic.

#### How it works

- The collector uses a `metrics_timer_` in the shared `state`, which fires every 60 seconds.
- Upon each tick, the collector:
   - Iterates over all non-expired entries in the system.
   - Retrieves the number of reads and writes for each entry using atomic operations.
   - Stores per-minute rates and updates accumulators.
   - Also processes per-command metrics for each active connection.
- After processing entries and connections, it calls `compute_all()` to finalize the global snapshot.

#### Internals

- Metrics are stored using atomic counters for both current-minute and accumulated stats.
- The timer is scheduled on the `strand_` of the state, ensuring serialized access.
- Each entry contains a `metrics_` pointer with six fields: current read/write counters, accumulators, and computed per-minute stats.
- Connections have their own `metrics_` structure, which includes 32 command slots for tracking usage patterns.
- `metric::compute()` is responsible for updating internal statistics from raw counters.
- The system avoids locking entirely by relying on relaxed atomic operations and strand-serialized rescheduling.

This design provides high-frequency metric updates with minimal performance overhead, and maintains accurate telemetry even under high throughput.

### Garbage Collector

Although not a separate class, the garbage collection behavior is implicit in how the system recycles buffers and message objects.

Each connection maintains a `message` object that is cleared and reused after every write. The recycling mechanism avoids unnecessary memory allocations and helps maintain consistent performance.

#### How it works

- The method `schedule_timer()` receives a proposed expiration timestamp. If the time has already passed, it triggers the collector immediately by calling `run()`. Otherwise, it sets a timer to fire at the exact moment.
- When the timer fires, `run()` is called. It:
   - Locks the shared state to avoid concurrent access.
   - Iterates through all entries in the `tag_by_key` index.
   - Marks entries as expired if their TTL has passed.
   - Physically erases entries that have been expired for more than 10 seconds.
   - Determines the next expiration point and re-schedules itself if needed.

#### Internals

- All expiration decisions and erasures are done inside `run()`, which guarantees consistency.
- The scheduling is dynamic and based on the real expiration of stored keys.
- The timer is only active when there are pending entries, keeping overhead minimal.
- The service logs key operations in debug mode (when `NDEBUG` is not defined).
- The whole lifecycle runs inside a `strand`-protected context by virtue of being synchronized via an external mutex (`state->mutex_`), not an internal `strand`.

This design replaces the older scheduler with a more explicit, transparent collector that ensures data integrity while maintaining low memory overhead and deterministic behavior.

### Connection Allocator

This component includes both `connection_handler_allocator<T>` and `connection_handler_memory`, designed for high-performance memory allocation in asynchronous operations.

It provides custom memory management for handlers used in Boost.Asio's `async_read` and `async_write`, minimizing heap allocations and reducing latency.

#### How it works

- Every connection owns a small stack-allocated buffer (`storage_`) embedded in a `connection_handler_memory` object.
- When the server initiates an async read or write, it binds the associated lambda or handler using `bind_allocator`, injecting the custom allocator.
- If the handler fits in the reserved space and no other handler is currently active, it is allocated from this stack buffer.
- Otherwise, it falls back to standard heap allocation via `operator new`.

This pattern is ideal for small lambdas and avoids unnecessary heap pressure during high-concurrency workloads.

#### Internals

- `connection_handler_memory` holds:
   - A 16-byte aligned buffer (`std::byte storage_[16]`) to store small handlers.
   - A `bool in_use_` flag to track usage.
- `connection_handler_allocator<T>`:
   - Acts as a wrapper for the memory pool.
   - Overrides `allocate()` and `deallocate()` to use `connection_handler_memory`.
   - Satisfies the C++ standard allocator concept for compatibility with Boost.Asio.

This mechanism enables predictable allocation behavior and supports millions of requests per second without allocator contention.

### Response Builder

The `response_builder_service` is responsible for encoding structured response data into the outgoing buffer, depending on the request type and available data. It's used by the `commands` logic when composing replies to client queries.

#### How it works

- When a command requires a structured response (e.g., CONNECTIONS or GET), it invokes the corresponding method in the `response_builder_service`.
- These methods append raw binary data directly into the `write_buffer_` of the connection’s reusable `message` instance.
- The builder uses pre-known offsets and binary formats for each type of response to ensure efficient, compact serialization.

This approach ensures all responses follow the Throttr protocol spec, maintaining consistency and eliminating overhead from generic serialization libraries.

#### Internals

- The service is stateless and uses only static methods.
- Each method receives:
   - A reference to the destination buffer (`std::vector<std::byte>&`).
   - Additional context-specific parameters (e.g., UUIDs, TTLs, metrics).
- The method `write_connections_entry_to_buffer` is one of the most complex, writing 227 bytes per connection including:
   - UUID (16 bytes)
   - IP version + address (17 bytes)
   - Port (2 bytes)
   - 21 metrics * 8 bytes each (168 bytes)
- It supports buffer fragmentation by returning how many entries were written per invocation, useful when slicing oversized payloads.

The builder is zero-copy and protocol-bound, designed for raw throughput and minimal latency.

### Finder

The `finder` component is responsible for retrieving entries from the in-memory store. It ensures the existence and validity of keys before commands proceed, acting as a gatekeeper for operations like `GET`, `SET`, `INCR`, etc.

It is invoked through `state->finder_->find_or_fail(...)`, returning a valid iterator or signaling failure.

#### How it works

- Commands delegate lookup responsibility to the `finder`, which performs a search in the `tag_by_key` index of the storage.
- If the key exists and has not expired, the iterator is returned.
- If not found or marked as expired, `std::nullopt` is returned, and depending on context, the failure is registered in a batch buffer.
- If metrics are enabled (`ENABLED_FEATURE_METRICS`), each successful read increments the key’s `reads_` counter for later aggregation.

This approach allows commands to remain agnostic of the underlying indexing and expiration logic.

#### Internals

- The `find_service` is a stateless singleton with static methods.
- Two methods are provided:
   - `find_or_fail(...)`: simple lookup with optional metrics tracking.
   - `find_or_fail_for_batch(...)`: same as above, but also appends a failure marker to the batch buffer if lookup fails.
- The underlying storage uses Boost.MultiIndex with a `tag_by_key` index for fast key-based lookups.
- Expired keys are filtered out by checking the `.expired_` flag, preventing access to stale data without needing immediate deletion.

This component is lightweight, synchronous, and tightly coupled with the command lifecycle, enabling deterministic and efficient behavior.

### Creator

The `creator` component is responsible for inserting new entries into the in-memory store. It is primarily used by commands like `SET`, `INSERT`, and `SUBSCRIBE` to allocate new records without overwriting existing ones unless specified.

#### Responsibilities

- Create new entries only if they don’t already exist (when `as_insert` is `true`).
- Calculate and assign the expiration timestamp based on the TTL and its type.
- Attach metrics to each entry for read/write tracking.
- Trigger the garbage collector scheduler if the inserted key’s expiration is earlier than currently scheduled entries.

#### Core behavior

- The method `create_service::use(...)` receives a `key`, `value`, TTL details, entry type, and request ID.
- It creates a new `entry_wrapper` with the decoded key and value, computes the expiration time, and tries to insert it into the `state->storage_`.
- If insertion succeeds, it performs the following:
   - Updates metrics (`writes_`) on the new entry.
   - Iterates over the index to determine if the new expiration time should preempt the garbage collector’s timer.
   - Posts a task to the strand to reschedule if needed, minimizing contention.

#### Efficiency notes

- The component uses Boost.MultiIndex for efficient key lookup and insertion.
- The current implementation performs a linear scan over the storage to find the earliest expiration point, which could be optimized by storing the earliest timestamp separately.
- TTL handling supports multiple modes (depending on `ttl_types`), abstracted behind `get_expiration_point(...)`.

This component plays a central role in maintaining correct memory hygiene, timing behavior, and system consistency during dynamic entry creation.

### Updater

The `updater` component is responsible for mutating existing attributes of entries, such as quota values or expiration time (TTL). It ensures updates are valid, atomic, and do not violate consistency or overstep logical constraints.

#### Responsibilities

- Apply arithmetic or direct value mutations to quota-related fields using `std::atomic`.
- Modify TTL values based on the `ttl_type` (seconds, milliseconds, nanoseconds), supporting patch, increase, or decrease operations.
- Post expiration reschedule tasks when the modified key is currently the one scheduled for purging.

#### Core behavior

- `update_service::apply_quota_change(...)` receives a target entry and mutation request, interprets the change type (patch, increase, decrease), and applies it to the atomic value embedded in the entry’s `value_` buffer.
   - All operations are atomic and use relaxed memory order for performance.
   - Decreases that would underflow the value return `false` to indicate failure.

- `update_service::apply_ttl_change(...)` recalculates the expiration point for an entry.
   - The expiration is extended or reduced based on the `change_type` and `ttl_type`.
   - If the updated key is the same as the scheduled one in the garbage collector, a new expiration is posted to the strand.

#### Efficiency notes

- The quota is assumed to be encoded as a native integer in-place within the `std::span<std::byte> value_`, relying on atomic reinterpretation for updates.
- TTL mutations are idempotent and thread-safe when accessed through the server strand.
- The logic is optimized for minimal locking and maximal throughput under high concurrency.

This component provides the safe mutation mechanisms needed to adapt state dynamically, enabling runtime tuning, expiration refreshes, and live quota adjustments.


[official GitHub repository]: https://github.com/throttr/throttr
buffers.
- This architecture enables high-throughput command processing with minimal overhead.

This component defines the behavioral core of the server by implementing each supported operation (insert, update, set, publish, etc.) in its own dedicated command unit.

### Messages

The `messages` component defines the logic for resolving message sizes dynamically from raw input buffers. It enables zero-copy parsing by determining the exact byte length required to consider a message "complete" for a given `request_type`.

#### Responsibilities

- Maps each `request_type` to a function capable of calculating the required byte size for that type.
- Enables early validation before dispatching commands, ensuring that the connection has received enough bytes.
- Allows the system to process incoming binary streams efficiently, without reallocations or temporary copies.

#### Implementation details

- The internal array `message_types_[]` holds one function pointer per possible message type (`std::array<size_callback, 32>`).
- Each callback receives a `std::span<const std::byte>` and returns the full expected size of the corresponding message.
- All functions perform minimal checks (usually validating size headers and extracting key lengths or payload sizes).
- For complex message types (e.g., `set`, `publish`, `update`), the functions parse specific byte positions to extract field lengths and compute total size.
- Incomplete messages return `0`, indicating that the parser should wait for more bytes.

#### Efficiency notes

- No heap allocation or data copying occurs during size resolution.
- Size functions avoid unnecessary branching and rely on fixed offset arithmetic.
- Designed for ultra-low-latency processing of streaming TCP data, especially under high-throughput conditions.

This component ensures that each message is parsed only when it's fully available, which is critical for a binary protocol system operating at scale.

### Metrics Collector

The metrics collector component is available only if `ENABLED_FEATURE_METRICS` is defined. It tracks the number of reads, writes, and processed commands.

Each connection may also have its own `connection_metrics` object for per-session statistics. The collector supports real-time observability and post-analysis of traffic.

#### How it works

- The collector uses a `metrics_timer_` in the shared `state`, which fires every 60 seconds.
- Upon each tick, the collector:
   - Iterates over all non-expired entries in the system.
   - Retrieves the number of reads and writes for each entry using atomic operations.
   - Stores per-minute rates and updates accumulators.
   - Also processes per-command metrics for each active connection.
- After processing entries and connections, it calls `compute_all()` to finalize the global snapshot.

#### Internals

- Metrics are stored using atomic counters for both current-minute and accumulated stats.
- The timer is scheduled on the `strand_` of the state, ensuring serialized access.
- Each entry contains a `metrics_` pointer with six fields: current read/write counters, accumulators, and computed per-minute stats.
- Connections have their own `metrics_` structure, which includes 32 command slots for tracking usage patterns.
- `metric::compute()` is responsible for updating internal statistics from raw counters.
- The system avoids locking entirely by relying on relaxed atomic operations and strand-serialized rescheduling.

This design provides high-frequency metric updates with minimal performance overhead, and maintains accurate telemetry even under high throughput.

### Garbage Collector

Although not a separate class, the garbage collection behavior is implicit in how the system recycles buffers and message objects.

Each connection maintains a `message` object that is cleared and reused after every write. The recycling mechanism avoids unnecessary memory allocations and helps maintain consistent performance.

#### How it works

- The method `schedule_timer()` receives a proposed expiration timestamp. If the time has already passed, it triggers the collector immediately by calling `run()`. Otherwise, it sets a timer to fire at the exact moment.
- When the timer fires, `run()` is called. It:
   - Locks the shared state to avoid concurrent access.
   - Iterates through all entries in the `tag_by_key` index.
   - Marks entries as expired if their TTL has passed.
   - Physically erases entries that have been expired for more than 10 seconds.
   - Determines the next expiration point and re-schedules itself if needed.

#### Internals

- All expiration decisions and erasures are done inside `run()`, which guarantees consistency.
- The scheduling is dynamic and based on the real expiration of stored keys.
- The timer is only active when there are pending entries, keeping overhead minimal.
- The service logs key operations in debug mode (when `NDEBUG` is not defined).
- The whole lifecycle runs inside a `strand`-protected context by virtue of being synchronized via an external mutex (`state->mutex_`), not an internal `strand`.

This design replaces the older scheduler with a more explicit, transparent collector that ensures data integrity while maintaining low memory overhead and deterministic behavior.

### Connection Allocator

This component includes both `connection_handler_allocator<T>` and `connection_handler_memory`, designed for high-performance memory allocation in asynchronous operations.

It provides custom memory management for handlers used in Boost.Asio's `async_read` and `async_write`, minimizing heap allocations and reducing latency.

#### How it works

- Every connection owns a small stack-allocated buffer (`storage_`) embedded in a `connection_handler_memory` object.
- When the server initiates an async read or write, it binds the associated lambda or handler using `bind_allocator`, injecting the custom allocator.
- If the handler fits in the reserved space and no other handler is currently active, it is allocated from this stack buffer.
- Otherwise, it falls back to standard heap allocation via `operator new`.

This pattern is ideal for small lambdas and avoids unnecessary heap pressure during high-concurrency workloads.

#### Internals

- `connection_handler_memory` holds:
   - A 16-byte aligned buffer (`std::byte storage_[16]`) to store small handlers.
   - A `bool in_use_` flag to track usage.
- `connection_handler_allocator<T>`:
   - Acts as a wrapper for the memory pool.
   - Overrides `allocate()` and `deallocate()` to use `connection_handler_memory`.
   - Satisfies the C++ standard allocator concept for compatibility with Boost.Asio.

This mechanism enables predictable allocation behavior and supports millions of requests per second without allocator contention.

### Response Builder

The `response_builder_service` is responsible for encoding structured response data into the outgoing buffer, depending on the request type and available data. It's used by the `commands` logic when composing replies to client queries.

#### How it works

- When a command requires a structured response (e.g., CONNECTIONS or GET), it invokes the corresponding method in the `response_builder_service`.
- These methods append raw binary data directly into the `write_buffer_` of the connection’s reusable `message` instance.
- The builder uses pre-known offsets and binary formats for each type of response to ensure efficient, compact serialization.

This approach ensures all responses follow the Throttr protocol spec, maintaining consistency and eliminating overhead from generic serialization libraries.

#### Internals

- The service is stateless and uses only static methods.
- Each method receives:
   - A reference to the destination buffer (`std::vector<std::byte>&`).
   - Additional context-specific parameters (e.g., UUIDs, TTLs, metrics).
- The method `write_connections_entry_to_buffer` is one of the most complex, writing 227 bytes per connection including:
   - UUID (16 bytes)
   - IP version + address (17 bytes)
   - Port (2 bytes)
   - 21 metrics * 8 bytes each (168 bytes)
- It supports buffer fragmentation by returning how many entries were written per invocation, useful when slicing oversized payloads.

The builder is zero-copy and protocol-bound, designed for raw throughput and minimal latency.

### Finder

The `finder` component is responsible for retrieving entries from the in-memory store. It ensures the existence and validity of keys before commands proceed, acting as a gatekeeper for operations like `GET`, `SET`, `INCR`, etc.

It is invoked through `state->finder_->find_or_fail(...)`, returning a valid iterator or signaling failure.

#### How it works

- Commands delegate lookup responsibility to the `finder`, which performs a search in the `tag_by_key` index of the storage.
- If the key exists and has not expired, the iterator is returned.
- If not found or marked as expired, `std::nullopt` is returned, and depending on context, the failure is registered in a batch buffer.
- If metrics are enabled (`ENABLED_FEATURE_METRICS`), each successful read increments the key’s `reads_` counter for later aggregation.

This approach allows commands to remain agnostic of the underlying indexing and expiration logic.

#### Internals

- The `find_service` is a stateless singleton with static methods.
- Two methods are provided:
   - `find_or_fail(...)`: simple lookup with optional metrics tracking.
   - `find_or_fail_for_batch(...)`: same as above, but also appends a failure marker to the batch buffer if lookup fails.
- The underlying storage uses Boost.MultiIndex with a `tag_by_key` index for fast key-based lookups.
- Expired keys are filtered out by checking the `.expired_` flag, preventing access to stale data without needing immediate deletion.

This component is lightweight, synchronous, and tightly coupled with the command lifecycle, enabling deterministic and efficient behavior.

### Creator

The `creator` component is responsible for inserting new entries into the in-memory store. It is primarily used by commands like `SET`, `INSERT`, and `SUBSCRIBE` to allocate new records without overwriting existing ones unless specified.

#### Responsibilities

- Create new entries only if they don’t already exist (when `as_insert` is `true`).
- Calculate and assign the expiration timestamp based on the TTL and its type.
- Attach metrics to each entry for read/write tracking.
- Trigger the garbage collector scheduler if the inserted key’s expiration is earlier than currently scheduled entries.

#### Core behavior

- The method `create_service::use(...)` receives a `key`, `value`, TTL details, entry type, and request ID.
- It creates a new `entry_wrapper` with the decoded key and value, computes the expiration time, and tries to insert it into the `state->storage_`.
- If insertion succeeds, it performs the following:
   - Updates metrics (`writes_`) on the new entry.
   - Iterates over the index to determine if the new expiration time should preempt the garbage collector’s timer.
   - Posts a task to the strand to reschedule if needed, minimizing contention.

#### Efficiency notes

- The component uses Boost.MultiIndex for efficient key lookup and insertion.
- The current implementation performs a linear scan over the storage to find the earliest expiration point, which could be optimized by storing the earliest timestamp separately.
- TTL handling supports multiple modes (depending on `ttl_types`), abstracted behind `get_expiration_point(...)`.

This component plays a central role in maintaining correct memory hygiene, timing behavior, and system consistency during dynamic entry creation.

### Updater

The `updater` component is responsible for mutating existing attributes of entries, such as quota values or expiration time (TTL). It ensures updates are valid, atomic, and do not violate consistency or overstep logical constraints.

#### Responsibilities

- Apply arithmetic or direct value mutations to quota-related fields using `std::atomic`.
- Modify TTL values based on the `ttl_type` (seconds, milliseconds, nanoseconds), supporting patch, increase, or decrease operations.
- Post expiration reschedule tasks when the modified key is currently the one scheduled for purging.

#### Core behavior

- `update_service::apply_quota_change(...)` receives a target entry and mutation request, interprets the change type (patch, increase, decrease), and applies it to the atomic value embedded in the entry’s `value_` buffer.
   - All operations are atomic and use relaxed memory order for performance.
   - Decreases that would underflow the value return `false` to indicate failure.

- `update_service::apply_ttl_change(...)` recalculates the expiration point for an entry.
   - The expiration is extended or reduced based on the `change_type` and `ttl_type`.
   - If the updated key is the same as the scheduled one in the garbage collector, a new expiration is posted to the strand.

#### Efficiency notes

- The quota is assumed to be encoded as a native integer in-place within the `std::span<std::byte> value_`, relying on atomic reinterpretation for updates.
- TTL mutations are idempotent and thread-safe when accessed through the server strand.
- The logic is optimized for minimal locking and maximal throughput under high concurrency.

This component provides the safe mutation mechanisms needed to adapt state dynamically, enabling runtime tuning, expiration refreshes, and live quota adjustments.


[official GitHub repository]: https://github.com/throttr/throttr
[Throttr Releases]: https://github.com/throttr/throttr/releases