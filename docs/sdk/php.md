# PHP

PHP `>= 8.1` client for communicating with a [Throttr Server](https://github.com/throttr/throttr).

The SDK enables [in-memory data objects](https://en.wikipedia.org/wiki/In-memory_database) and [rate limiting](https://en.wikipedia.org/wiki/Rate_limiting) efficiently, only using TCP, respecting the server's native binary protocol.

## 🛠️ Installation

Add the dependency using Composer:

```bash
composer require throttr/sdk
```

## Basic Usage

### As Rate Limiter

```php
<?php

require 'vendor/autoload.php';

use Throttr\SDK\Service;
use Throttr\SDK\Enum\TTLType;
use Throttr\SDK\Enum\AttributeType;
use Throttr\SDK\Enum\ChangeType;
use Throttr\SDK\Enum\ValueSize;

// Configure your instance with 4 connections and a value size (e.g. UINT16)
$service = new Service('127.0.0.1', 9000, ValueSize::UINT16, 4);

// Define the key ... it can be an IP+port, UUID, route, etc.
$key = '127.0.0.1:/api/resource';

// Connect to Throttr
$service->connect();

// Insert a rule for this key
$service->insert(
    key: $key,
    ttl: 3000,
    ttlType: TTLType::MILLISECONDS,
    quota: 5
);

// Query the current state
$response = $service->query($key);

printf(
    "Allowed: %s, Remaining: %d, TTL: %dms\n",
    $response->success() ? 'true' : 'false',
    $response->quota() ?? 0,
    (int)($response->ttl() ?? 0)
);

// Update the quota (consume 1)
$service->update(
    key: $key,
    attribute: AttributeType::QUOTA,
    change: ChangeType::DECREASE,
    value: 1
);

// Query again
$response = $service->query($key);

printf(
    "Success: %s, Quota: %d, TTL: %dms\n",
    $response->success() ? 'true' : 'false',
    $response->quota() ?? 0,
    (int)($response->ttl() ?? 0)
);

```

### As in-memory database

```php
$key = 'json-storage';

$set = $service->set(
    key: $key,
    ttl: 6,
    ttlType: TTLType::HOURS,
    value: "EHLO"
);

echo "SET status: " . $set->success() . PHP_EOL;

$get = $service->get(
    key: $key,
);

echo "GET status: " . $get->success() . PHP_EOL;
echo "GET value: " . $get->value() . PHP_EOL; // Must be "EHLO"

// Close connections
$service->close();
```

## Technical Notes

- The protocol assumes Little Endian architecture.
- The internal message queue ensures requests are processed sequentially.
- The package is defined to works with protocol 4.0.14 or greatest.

---

## License

Distributed under the [GNU Affero General Public License v3.0](./LICENSE).