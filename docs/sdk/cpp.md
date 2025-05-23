# C++

## Installation

Add the dependency to your `CMakeLists.txt`:

```CMakeLists.txt
include(FetchContent)
        FetchContent_Declare(
        throttr-sdk
        GIT_REPOSITORY https://github.com/throttr/cpp.git
        GIT_TAG 5.1.1
)
FetchContent_MakeAvailable(throttr-sdk)

target_link_libraries(
    YourProgram
    throttr::sdk
)
```


## Basic Usage

### Get Connected

Use the Service to create a communication channel between your application and Throttr server.

```cpp
#include <throttr/service.hpp>

using namespace throttr;

const auto _host = "throttr";
const auto _port = 9000;
const auto _connections = 9000;

boost::asio::io_context _io;

service_config _cfg{
    _host,
    _port,
    _connections
};

const auto _service = std::make_unique<service>(_io.get_executor(), _cfg);

bool _ready = false;
_service->connect([&](const boost::system::error_code &ec) {
    if (ec) {
        throw std::runtime_exception("Server is gone");
    }
    _ready = true;
});

while (!_ready)
    _io.run_one();
_io.restart();
```

After that, `service` will be an instance that can be used in concurrently.

My recommendation, use just one `_service` per thread.


### Sending Requests

The following operations are based in Throttr protocol `v5.0.0`.

#### INSERT

If you want to create a `counter` to track requests or metrics. Then `INSERT` is for you.

```cpp
#include <throttr/protocol_wrapper.hpp>
#include <throttr/response_status.hpp>

using namespace throttr;

const std::string _key = "consumer";
const auto _quota = 5;
const auto _ttl_type = ttl_types::seconds;
const auto _ttl = 60;

const std::vector<std::byte> _insert_buffer = request_insert_builder(
    _quota,
    _ttl_type,
    _ttl,
    _key
);

_service->send<response_status>(_insert_buffer,
    [&](const boost::system::error_code& ec, const response_status result) {
        if (!ec) {
            std::cout << "Success: " << result.success_ << std::endl;
        } else {
            std::cerr << "Something went wrong: " << ec.what() << std::endl;
        }
});
```

There are only one condition that `success_` can be `false`, and is, when the `key` already exists.

#### QUERY

If you want to recover the `counter` value or TTL specification. Then `QUERY` is for you.

```cpp
#include <throttr/protocol_wrapper.hpp>
#include <throttr/response_query.hpp>

using namespace throttr;

const std::string _key = "consumer";

const std::vector<std::byte> _query_buffer = request_query_builder(_key);

_service->send<response_query>(_query_buffer,
    [&](const boost::system::error_code& ec, const response_query result) {
        if (!ec) {
            std::cout << "Success: " << result.success_ << std::endl;
            
            if (result.success_) {
                std::cout << "Quota: " << result.quota_ << std::endl;
                std::cout << "TTL: " << result.ttl_ << std::endl;
                std::cout << "TTL_Type: " << result.ttl_type_ << std::endl;
            }
        } else {
            std::cerr << "Something went wrong: " << ec.what() << std::endl;
        }
});
```

There are only one condition that `success_` can be `false`, and is, when the `key` doesn't exist.

In that case, `quota_`, `ttl_` and `ttl_type_` will contain `invalid` values.

#### UPDATE

If you want to modify the `counter` value or TTL. Then `UPDATE` is for you.

```cpp
#include <throttr/protocol_wrapper.hpp>
#include <throttr/response_status.hpp>

using namespace throttr;

const std::string _key = "consumer";
const auto _attribute_type = attribute_types::quota;
const auto _change_type = change_types::decrease;
const value_type _value = 1;

const std::vector<std::byte> _update_buffer = request_update_builder(
    _attribute_type,
    _change_type,
    _value,
    _key
);

_service->send<response_status>(_update_buffer,
    [&](const boost::system::error_code& ec, const response_status result) {
        if (!ec) {
            std::cout << "Success: " << result.success_ << std::endl;
        } else {
            std::cerr << "Something went wrong: " << ec.what() << std::endl;
        }
});
```

There are two attributes that can be modified `Quota` and `TTL`.

There are three change type that can be invoked:

- `PATCH` to replace the value.
- `INCREASE` to extend the quota or increase the metric.
- `DECREASE` to consume the quota or decrease the metric.

There are two different cases that `success_` can be `false`:

- `Key` doesn't exists.
- `Quota` is less than the value that want to be reduced. IE: Quota is 20, but you want to `DECREASE` 50.

The last case is relevant because you can combine `INSERT` + `UPDATE` as pattern.

#### PURGE

If you want, manually, remove the `counter` or `buffer`. Then `PURGE` is for you.

```cpp
#include <throttr/protocol_wrapper.hpp>
#include <throttr/response_status.hpp>

using namespace throttr;

const std::string _key = "consumer";

const std::vector<std::byte> _purge_buffer = request_purge_builder(
    _key
);

_service->send<response_status>(_purge_buffer,
    [&](const boost::system::error_code& ec, const response_status result) {
        if (!ec) {
            std::cout << "Success: " << result.success_ << std::endl;
        } else {
            std::cerr << "Something went wrong: " << ec.what() << std::endl;
        }
});
```

There are only one condition that `success_` can be `false`, and is, when the `key` doesn't exist.

#### SET

If you want, create a `buffer` (arbitrary data in memory). Then `SET` is for you.

```cpp
#include <throttr/protocol_wrapper.hpp>
#include <throttr/response_status.hpp>

using namespace throttr;

const std::string _key = "consumer";
const auto _ttl_type = ttl_types::seconds;
const auto _ttl = 60;
const std::vector _value = {
    std::byte{'E'},
    std::byte{'H'},
    std::byte{'L'},
    std::byte{'O'}
};

const std::vector<std::byte> _set_buffer = request_set_builder(
    _value,
    _ttl_type,
    _ttl,
    _key
);

_service->send<response_status>(_set_buffer,
    [&](const boost::system::error_code& ec, const response_status result) {
        if (!ec) {
            std::cout << "Success: " << result.success_ << std::endl;
        } else {
            std::cerr << "Something went wrong: " << ec.what() << std::endl;
        }
});
```

There are only one condition that `success` can be `false`, and is, when the `key` already exist.

#### GET

If you want, recover a `buffer`. Then `GET` is for you.

```cpp
#include <throttr/protocol_wrapper.hpp>
#include <throttr/response_get.hpp>

using namespace throttr;

const std::string _key = "consumer";

const std::vector<std::byte> _get_buffer = request_get_builder(
    _key
);

_service->send<response_get>(_get_buffer,
    [&](const boost::system::error_code& ec, const response_get result) {
        if (!ec) {
            std::cout << "Success: " << result.success_ << std::endl;
            
            if (result.success_) {
                std::cout << "Value: ";
                for (const auto & byte : result.value_) {
                    std::cout << byte;
                }
                std::cout << std::endl;
                std::cout << "TTL: " << result.ttl_ << std::endl;
                std::cout << "TTL_Type: " << result.ttl_type_ << std::endl;
            }
        } else {
            std::cerr << "Something went wrong: " << ec.what() << std::endl;
        }
});
```

There are only one condition that `success` can be `false`, and is, when the `key` doesn't exist.

### Get Disconnected

Once your operations has been finished, you could release resources using:

```cpp
_service.reset();
```

## Advanced Usage

I will show you my recommended usages as previous requests are just raw protocol.

### Optimized Rate Limiter

Avoid the usage of `INSERT` and `UPDATE` as two separated requests. Call it as `batch`.

The `send_many` function is variadic. This reduces two or more requests in a single TCP message.

This mechanism provides to you enough information to `allow` or `block` a request.

```cpp
#include <throttr/protocol_wrapper.hpp>
#include <throttr/response_status.hpp>

using namespace throttr;

const std::string _key = "consumer";
const auto _quota = 5;
const auto _ttl_type = ttl_types::seconds;
const auto _ttl = 60;

const std::vector<std::byte> _insert_buffer = request_insert_builder(
    _quota,
    _ttl_type,
    _ttl,
    _key
);

const auto _attribute_type = attribute_types::quota;
const auto _change_type = change_types::decrease;
const value_type _value = 1;

const std::vector<std::byte> _update_buffer = request_update_builder(
    _attribute_type,
    _change_type,
    _value,
    _key
);

std::vector _requests = {_insert_buffer, _update_buffer};

_service->send_many<
    response_status,
    response_status
>(
    [&](
        const boost::system::error_code& ec,
        const response_status insert_result,
        const response_status update_result
    ) {
        if (!ec) {
            std::cout << "Insert Success: " << insert_result.success_ << std::endl;
            std::cout << "Update Success: " << update_result.success_ << std::endl;
        } else {
            std::cerr << "Something went wrong: " << ec.what() << std::endl;
        }
    },
    std::move(_requests)
);
```

If `INSERT` was `success` then is the first consume time and if `UPDATE` was `success` then the user had available quota.

See more examples in [tests](https://github.com/throttr/cpp/blob/master/tests/service_test.cc).

## Technical Notes

- The protocol assumes Little Endian architecture.
- The internal message queue ensures requests are processed sequentially.
- The package is defined to works with protocol 4.0.17 or greatest.

---

## License

Distributed under the [GNU Affero General Public License v3.0](https://github.com/throttr/typescript/blob/master/LICENSE).