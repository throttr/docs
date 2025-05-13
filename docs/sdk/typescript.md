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

### As Rate Limiter

```typescript
import { Service, RequestType, TTLType, AttributeType, ChangeType, ValueSize } from '@throttr/sdk';

const service = new Service({
    host: '127.0.0.1',
    port: 9000,
    max_connections: 4, // Optional: configure concurrent connections
    value_type: ValueSize.UInt16,
});

// Define a key (example: IP + port + path, UUID, or custom identifier)
const key = '127.0.0.1:1234/api/resource';

// Connect to Throttr
await service.connect();

// Insert quota for a consumer-resource pair
const insert_response = await service.send({
    type: RequestType.Insert,
    key: key,
    quota: 5,
    ttl_type: TTLType.Seconds,
    ttl: 60,
});

console.log('Success:', insert_response.success);

// Update the available quota
await service.send({
    type: RequestType.Update,
    attribute: AttributeType.Quota,
    change: ChangeType.Decrease,
    value: 1,
});

// Query the available quota
const query_response = await service.send({
    type: RequestType.Query,
    key: key,
});

console.log('Success:', query_response.success);
console.log('Quota:', query_response.quota);
console.log('TTL Type:', query_response.ttl_type);
console.log('TTL:', query_response.ttl);

// Optionally, purge the quota
await service.send({
    type: RequestType.Purge,
    key: key,
});
```

### As Database

```typescript
const key = 'json-storage';

// Set arbitrary data into the storage
const set_response = await service.send({
    type: RequestType.Set,
    key: key,
    ttl_type: TTLType.Hours,
    ttl: 24,
    value: 'EHLO',
});

// Get from the memory
const get_response = await service.send({
    type: RequestType.Get,
    key: key,
});

console.log('Data: ', get_response.value); // Must be "EHLO"

// Optionally, purge the key
await service.send({
    type: RequestType.Purge,
    key: key,
});

// Disconnect once done
service.disconnect();
```

See more examples in [tests](https://github.com/throttr/typescript/blob/master/tests/service.test.ts).


## Technical Notes

- The protocol assumes Little Endian architecture.
- The internal message queue ensures requests are processed sequentially.
- The package is defined to works with protocol 4.0.14 or greatest.

---

## License

Distributed under the [GNU Affero General Public License v3.0](https://github.com/throttr/typescript/blob/master/LICENSE).