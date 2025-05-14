# TypeScript / JavaScript

## Installation

Add the dependency using Yarn or NPM:

```bash
yarn add @throttr/sdk
```

or

```bash
npm install @throttr/sdk
```

## Basic Usage

### Get Connected

Use the Service to create a communication channel between your application and Throttr server.

```typescript
import { Service, ValueSize } from '@throttr/sdk';

const HOST = '127.0.0.1';
const PORT = 9000;
const MAX_CONNECTIONS = 4;
const DYNAMIC_VALUE_SIZE = ValueSize.UInt16;

const service = new Service({
    host: HOST,
    port: PORT,
    max_connections: MAX_CONNECTIONS,
    value_type: DYNAMIC_VALUE_SIZE,
});

service.connect();
```

After that, `service` will be a instance that can be used in concurrently. 

Every connection contained in service has his own requests resolve promise queue. This guarantees 
that every single request make against the server will be resolved one by one. Even, if you sent it as batch.

Requests **can fail**, mainly, for external causes. I/O, Network stability and so on. Using `try / catch` is recommended.

As `send` function returns a `Promise` then you could as you wish, using `await` or `then`.

### Sending Requests

The following operations are based in Throttr protocol `v5.0.0`.

#### INSERT

If you want to create a `counter` to track requests or metrics. Then `INSERT` is for you.

```typescript
import { RequestType, TTLType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Insert;
const KEY = 'NON_EXISTING_KEY';
const QUOTA = 5;
const TTL = 60;
const TTL_TYPE = TTLType.Seconds;

const response = await service.send({
    type: REQUEST_TYPE,
    key: KEY,
    quota: QUOTA,
    ttl_type: TTL_TYPE,
    ttl: TTL,
});

console.log(`Status: ${response.success}`);
```

There are only one condition that `success` can be `false`, and is, when the `key` already exists.

#### QUERY

If you want to recover the `counter` value or TTL specification. Then `QUERY` is for you.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Query;
const KEY = 'EXISTING_KEY';

const response = await service.send({
    type: REQUEST_TYPE,
    key: KEY,
});

console.log(`Status: ${response.success}`);
console.log(`Quota: ${response.quota}`);
console.log(`TTL: ${response.ttl}`);
console.log(`TTL Type: ${response.ttl_type}`);
```

There are only one condition that `success` can be `false`, and is, when the `key` doesn't exist.

In that case, `quota`, `ttl` and `ttl_type` will contain `invalid` values.

#### UPDATE

If you want to modify the `counter` value or TTL. Then `UPDATE` is for you.

```typescript
import { RequestType, AttributeType, ChangeType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Update;
const KEY = 'EXISTING_KEY';
const ATTRIBUTE_TYPE = AttributeType.Quota; // Can be "TTL".
const CHANGE_TYPE = ChangeType.Increase; // Can be "Decrease" or "Patch". 
const VALUE = 10;

const response = await service.send({
    type: REQUEST_TYPE,
    key: KEY,
    attribute: ATTRIBUTE_TYPE,
    change: CHANGE_TYPE,
    value: VALUE,
});

console.log(`Status: ${response.success}`);
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

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Purge;
const KEY = 'EXISTING_KEY';

const response = await service.send({
    type: REQUEST_TYPE,
    key: KEY,
});

console.log(`Status: ${response.success}`);
```

There are only one condition that `success` can be `false`, and is, when the `key` doesn't exist.

#### SET

If you want, create a `buffer` (arbitrary data in memory). Then `SET` is for you.

```typescript
import { RequestType, TTLType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Set;
const KEY = 'NON_EXISTING_KEY';
const TTL = 24;
const TTL_TYPE = TTLType.Hours;
const VALUE = "EHLO";

const response = await service.send({
    type: REQUEST_TYPE,
    key: KEY,
    ttl_type: TTL_TYPE,
    ttl: TTL,
    value: VALUE,
});

console.log(`Status: ${response.success}`);
```

There are only one condition that `success` can be `false`, and is, when the `key` already exist.

#### GET

If you want, recover a `buffer`. Then `GET` is for you.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Get;
const KEY = 'EXISTING_KEY';

const response = await service.send({
    type: REQUEST_TYPE,
    key: KEY,
});

console.log(`Status: ${response.success}`);
console.log(`TTL: ${response.ttl}`);
console.log(`TTL Type: ${response.ttl_type}`);
console.log(`Value: ${response.value}`);
```

There are only one condition that `success` can be `false`, and is, when the `key` doesn't exist.

### Get Disconnected

Once your operations has been finished, you could release resources using:

```typescript
service.disconnect();
```

See more examples in [tests](https://github.com/throttr/typescript/blob/master/tests/service.test.ts).

## Advanced Usage

I will show you my recommended usages as previous requests are just raw protocol.

### Optimize Rate Limiter

Avoid the usage of `INSERT` and `UPDATE` as two separated requests. Call it as `batch`.

The `send` function also receives `Array`. This reduces two TCP message to only one.

This mechanism provides to you enough information to `allow` or `block` a request.

```typescript
import { RequestType, TTLType, AttributeType, ChangeType } from '@throttr/sdk';

const KEY = "BATCH";
const TTL_TYPE = TTLType.Seconds;
const TTL = 60;
const QUOTA = 120;
const ATTRIBUTE_TYPE = AttributeType.Quota;
const CHANGE_TYPE = ChangeType.Decrease;

const [first, second] = await service.send([
    {
        type: RequestType.Insert,
        key: KEY,
        quota: QUOTA,
        ttl_type: TTL_TYPE,
        ttl: TTL,
    },
    {
        type: RequestType.Update,
        key: KEY,
        attribute: ATTRIBUTE_TYPE,
        change: CHANGE_TYPE,
        value: VALUE,
    },
]);
```


If `INSERT` was `success` then is the first consume time and if `UPDATE` was `success` then the user had available quota.

## Technical Notes

- The protocol assumes Little Endian architecture.
- The internal message queue ensures requests are processed sequentially.
- The package is defined to works with protocol 4.0.14 or greatest.

---

## License

Distributed under the [GNU Affero General Public License v3.0](https://github.com/throttr/typescript/blob/master/LICENSE).