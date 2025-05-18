# PHP

## Installation

Add the dependency using Composer:

```bash
composer require throttr/sdk
```

## Basic Usage

### Get Connected

Use the Service to create a communication channel between your application and Throttr server.

```php
use Throttr\SDK\Service;
use Throttr\SDK\Enum\ValueSize;

$HOST = '127.0.0.1';
$PORT = 9000;
$MAX_CONNECTIONS = 4;
$DYNAMIC_VALUE_SIZE = ValueSize::UINT16;

$service = new Service(
    $HOST,
    $PORT,
    $DYNAMIC_VALUE_SIZE,
    $MAX_CONNECTIONS
);

$service->connect();
```

After that, `service` will be a instance that can be used in concurrently.

Every connection contained in service has his own requests resolve promise queue. This guarantees
that every single request make against the server will be resolved one by one. Even, if you sent it as batch.

Requests **can fail**, mainly, for external causes. I/O, Network stability and so on. Using `try / catch` is recommended.

### Sending Requests

The following operations are based in Throttr protocol `v5.0.0`.

#### INSERT

If you want to create a `counter` to track requests or metrics. Then `INSERT` is for you.

```php
use Throttr\SDK\Enum\TTLType;

$KEY = 'NON_EXISTING_KEY';
$QUOTA = 5;
$TTL = 60;
$TTL_TYPE = TTLType::SECONDS;

$response = $service->insert(
    key: $KEY,
    ttl: $TTL,
    ttlType: $TTL_TYPE,
    quota: $QUOTA
);

echo "Status : " . $response->success() . PHP_EOL;
```

There are only one condition that `success` can be `false`, and is, when the `key` already exists.

#### QUERY

If you want to recover the `counter` value or TTL specification. Then `QUERY` is for you.

```php
$KEY = 'EXISTING_KEY';

$response = $service->query($KEY);

echo "Status : " . $response->success() . PHP_EOL;
echo "Quota : " . $response->quota() . PHP_EOL;
echo "TTL : " . $response->ttl() . PHP_EOL;
echo "TTL Type : " . $response->ttlType() . PHP_EOL;
```

There are only one condition that `success` can be `false`, and is, when the `key` doesn't exist.

In that case, `quota`, `ttl` and `ttl_type` will contain `invalid` values.

#### UPDATE

If you want to modify the `counter` value or TTL. Then `UPDATE` is for you.

```php
use Throttr\SDK\Enum\AttributeType;
use Throttr\SDK\Enum\ChangeType;

$KEY = 'EXISTING_KEY';
$ATTRIBUTE_TYPE = AttributeType::QUOTA;
$CHANGE_TYPE = ChangeType::INCREASE;
$VALUE = 20;

$service->update($KEY, $ATTRIBUTE_TYPE, $CHANGE_TYPE, $VALUE);

echo "Status : " . $response->success() . PHP_EOL;
```

There are two attributes that can be modified `Quota` and `TTL`.

There are three change type that can be invoked:

- `PATCH` to replace the value.
- `INCREASE` to extend the quota or increase the metric.
- `DECREASE` to consume the quota or decrease the metric.

There are two different cases that `success` can be `false`:

- `Key` doesn't exists.
- `Quota` is less than the value that want to be reduced. IE: Quota is 20, but you want to `DECREASE` 50.

The last case is relevant because you can combine `INSERT` + `UPDATE` as pattern in batch.

#### PURGE

If you want, manually, remove the `counter` or `buffer`. Then `PURGE` is for you.

```php
$KEY = 'EXISTING_KEY';

$response = $service->purge($KEY);

echo "Status : " . $response->success() . PHP_EOL;
```

There are only one condition that `success` can be `false`, and is, when the `key` doesn't exist.

#### SET

If you want, create a `buffer` (arbitrary data in memory). Then `SET` is for you.

```php
use Throttr\SDK\Enum\TTLType;

$KEY = 'NON_EXISTING_KEY';
$VALUE = 'EHLO';
$TTL = 60;
$TTL_TYPE = TTLType::SECONDS;

$response = $service->set(
    key: $KEY,
    ttl: $TTL,
    ttlType: $TTL_TYPE,
    value: $VALUE
);

echo "Status : " . $response->success() . PHP_EOL;
```

There are only one condition that `success` can be `false`, and is, when the `key` already exist.

#### GET

If you want, recover a `buffer`. Then `GET` is for you.

```php
$KEY = 'EXISTING_KEY';

$response = $service->get($KEY);

echo "Status : " . $response->success() . PHP_EOL;
echo "TTL : " . $response->ttl() . PHP_EOL;
echo "TTL Type : " . $response->ttlType() . PHP_EOL;
echo "Value : " . $response->value() . PHP_EOL;
```

There are only one condition that `success` can be `false`, and is, when the `key` doesn't exist.

### Get Disconnected

Once your operations has been finished, you could release resources using:

```php
$service->disconnect();
```

See more examples in [tests](https://github.com/throttr/php/blob/master/tests/ServiceTest.php).

## Advanced Usage

I will show you my recommended usages as previous requests are just raw protocol.

### Optimized Rate Limiter

Avoid the usage of `INSERT` and `UPDATE` as two separated requests. Call it as `batch`.

The `send` function also receives `Array`. This reduces two TCP message to only one.

This mechanism provides to you enough information to `allow` or `block` a request.

```php
use Throttr\SDK\Requests\InsertRequest;
use Throttr\SDK\Requests\UpdateRequest;
use Throttr\SDK\Enum\TTLType;
use Throttr\SDK\Enum\AttributeType;
use Throttr\SDK\Enum\ChangeType;

$KEY = "BATCH";
$TTL_TYPE = TTLType::SECONDS;
$TTL = 60;
$QUOTA = 120;
$STEP = 1;
$ATTRIBUTE_TYPE = AttributeType::QUOTA;
$CHANGE_TYPE = ChangeType::DECREASE;

const $responses = $service->send([
    new InsertRequest(
        key: $KEY,
        quota: $QUOTA,
        ttl_type: $TTL_TYPE,
        ttl: $TTL
    ),
    new UpdateRequest(
        attribute: $ATTRIBUTE_TYPE,
        change: $CHANGE_TYPE,
        value: $STEP,
        key: $KEY,
    ),
]);

foreach ($responses as $response) {
    echo "Status : " . $response->success() . PHP_EOL;
}
```

If `INSERT` was `success` then is the first consume time and if `UPDATE` was `success` then the user had available quota.

## Technical Notes

- The protocol assumes Little Endian architecture.
- The internal message queue ensures requests are processed sequentially.
- The package is defined to works with protocol 4.0.14 or greatest.

---

## License

Distributed under the [GNU Affero General Public License v3.0](https://github.com/throttr/typescript/blob/master/LICENSE).