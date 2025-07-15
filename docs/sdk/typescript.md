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


### Configuration

Throttr SDK for TypeScript exposes several configuration options that can be passed to Service:

#### Host

Attribute `host` is the Throttr Server domain or IP. Usually `127.0.0.1` or `localhost`.

#### Port

Attribute `port` is the Throttr Server port. Usually is `9000`.

#### Maximum connections

Attribute `max_connections` is the number of connections from the beginning. Default is `1`.

#### Value size

Attribute `value_type` is the variant of Throttr Server. Default is `uint16`.

#### Connection configuration

Attribute `connection_configuration` is an object of `T<ConnectionConfiguration>`.

##### Wait for writable socket attempts

Attribute `on_wait_for_writable_socket_attempts` is the maximum attempts of waiting for writable socket. Default is `3`.

##### Wait for writable socket timeout

Attribute `on_wait_for_writable_socket_timeout_per_attempt` is the timeout used per attempt. Default is `1000` milliseconds.

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

#### LIST

If you want, recover all the metadata of keys stored.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.List;

const response = await service.send({
    type: REQUEST_TYPE,
});

console.log(`Status: ${response.success}`);

console.log(`Number of keys: ${response.keys.length}`);

response.keys.forEach((item) => {
    console.log(`Key: ${item.key}`);
    console.log(`Type: ${item.key_type}`);
    console.log(`TTL Type: ${item.ttl_type}`);
    console.log(`Expires At: ${item.expires_at}`);
    console.log(`Bytes used: ${item.bytes_used}`);
})
```

#### INFO

If you want, get the instance information.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Info;

const response = await service.send({
    type: REQUEST_TYPE,
});

console.log(`Status: ${response.success}`);

console.log(`Timestamp: ${response.timestamp}`);
console.log(`Total Requests: ${response.total_requests}`);
console.log(`Total Requests Per Minute: ${response.total_requests_per_minute}`);
console.log(`Total INSERT Requests: ${response.total_insert_requests}`);
console.log(`Total INSERT Requests Per Minute: ${response.total_insert_requests_per_minute}`);
console.log(`Total QUERY Requests: ${response.total_query_requests}`);
console.log(`Total QUERY Requests Per Minute: ${response.total_query_requests_per_minute}`);
console.log(`Total UPDATE Requests: ${response.total_update_requests}`);
console.log(`Total UPDATE Requests Per Minute: ${response.total_update_requests_per_minute}`);
console.log(`Total PURGE Requests: ${response.total_purge_requests}`);
console.log(`Total PURGE Requests Per Minute: ${response.total_purge_requests_per_minute}`);
console.log(`Total GET Requests: ${response.total_get_requests}`);
console.log(`Total GET Requests Per Minute: ${response.total_get_requests_per_minute}`);
console.log(`Total SET Requests: ${response.total_set_requests}`);
console.log(`Total SET Requests Per Minute: ${response.total_set_requests_per_minute}`);
console.log(`Total LIST Requests: ${response.total_list_requests}`);
console.log(`Total LIST Requests Per Minute: ${response.total_list_requests_per_minute}`);
console.log(`Total INFO Requests: ${response.total_info_requests}`);
console.log(`Total INFO Requests Per Minute: ${response.total_info_requests_per_minute}`);
console.log(`Total STATS Requests: ${response.total_stats_requests}`);
console.log(`Total STATS Requests Per Minute: ${response.total_stats_requests_per_minute}`);
console.log(`Total STAT Requests: ${response.total_stat_requests}`);
console.log(`Total STAT Requests Per Minute: ${response.total_stat_requests_per_minute}`);
console.log(`Total SUBSCRIBE Requests: ${response.total_subscribe_requests}`);
console.log(`Total SUBSCRIBE Requests Per Minute: ${response.total_subscribe_requests_per_minute}`);
console.log(`Total UNSUBSCRIBE Requests: ${response.total_unsubscribe_requests}`);
console.log(`Total UNSUBSCRIBE Requests Per Minute: ${response.total_unsubscribe_requests_per_minute}`);
console.log(`Total PUBLISH Requests: ${response.total_publish_requests}`);
console.log(`Total PUBLISH Requests Per Minute: ${response.total_publish_requests_per_minute}`);
console.log(`Total CHANNEL Requests: ${response.total_channel_requests}`);
console.log(`Total CHANNEL Requests Per Minute: ${response.total_channel_requests_per_minute}`);
console.log(`Total CHANNELS Requests: ${response.total_channels_requests}`);
console.log(`Total CHANNELS Requests Per Minute: ${response.total_channels_requests_per_minute}`);
console.log(`Total WHOAMI Requests: ${response.total_whoami_requests}`);
console.log(`Total WHOAMI Requests Per Minute: ${response.total_whoami_requests_per_minute}`);
console.log(`Total CONNECTION Requests: ${response.total_connection_requests}`);
console.log(`Total CONNECTION Requests Per Minute: ${response.total_connection_requests_per_minute}`);
console.log(`Total CONNECTIONS Requests: ${response.total_connections_requests}`);
console.log(`Total CONNECTIONS Requests Per Minute: ${response.total_connections_requests_per_minute}`);
console.log(`Total Read Bytes: ${response.total_read_bytes}`);
console.log(`Total Read Rytes Per Minute: ${response.total_read_bytes_per_minute}`);
console.log(`Total Write Bytes: ${response.total_write_bytes}`);
console.log(`Total Write Rytes Per Minute: ${response.total_write_bytes_per_minute}`);
console.log(`Total Keys: ${response.total_keys}`);
console.log(`Total Counters: ${response.total_counters}`);
console.log(`Total Allocated Bytes On Counters: ${response.total_allocated_bytes_on_counters}`);
console.log(`Total Allocated Bytes on Buffers: ${response.total_allocated_bytes_on_buffers}`);
console.log(`Total Subscriptions: ${response.total_subscriptions}`);
console.log(`Total Channels: ${response.total_channels}`);
console.log(`Start Up Timestamp: ${response.startup_timestamp}`);
console.log(`Total Connections: ${response.total_connections}`);
console.log(`Version: ${response.version}`);
```


#### STAT

If you want, get the `key` metrics.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Stat;
const KEY = 'EXISTING_KEY';

const response = await service.send({
    type: REQUEST_TYPE,
    key: KEY,
});

console.log(`Status: ${response.success}`);

console.log(`Reads Per Minute: ${response.reads_per_minute}`);
console.log(`Writes Per Minute: ${response.writes_per_minute}`);
console.log(`Total Reads: ${response.total_reads}`);
console.log(`Total Writes: ${response.total_writes}`);
```

#### STATS

If you want, get metrics of all the keys.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Stats;
const KEY = 'EXISTING_KEY';

const response = await service.send({
    type: REQUEST_TYPE,
    key: KEY,
});

console.log(`Status: ${response.success}`);

response.forEach((item) => {
    console.log(`Key ${item.key}`);
    console.log(`Reads Per Minute: ${item.reads_per_minute}`);
    console.log(`Writes Per Minute: ${item.writes_per_minute}`);
    console.log(`Total Reads: ${item.total_reads}`);
    console.log(`Total Writes: ${item.total_writes}`);
})
```

#### SUBSCRIBE

If you want, get subscribed to a channel.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Subscribe;
const CHANNEL = 'MY-CHANNEL';

const response = await service.send({
    type: REQUEST_TYPE,
    channel: CHANNEL,
    callback: (data: string) => {
        console.log(`Data: ${data}`);
    }
});

console.log(`Status: ${response.success}`);
```

> Notes:
> 1. If you use SUBSCRIBE, then, all your connection of the pool will get SUBSCRIBED,


#### UNSUBSCRIBE

If you want, get unsubscribed to a channel.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Unsubscribe;
const CHANNEL = 'MY-CHANNEL';

const response = await service.send({
    type: REQUEST_TYPE,
    channel: CHANNEL,
});

console.log(`Status: ${response.success}`);
```

> Notes:
> 1. This response will fail if you're not subscribed.

#### PUBLISH

If you want, publish data to a channel.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Publish;
const CHANNEL = 'MY-CHANNEL';

const response = await service.send({
    type: REQUEST_TYPE,
    channel: CHANNEL,
    value: "EHLO"
});

console.log(`Status: ${response.success}`);
```

> Notes:
> 1. Use `*` to PUBLISH to all connections (BROADCASTING).
> 2. Use connection ID to send data to specific connection.
> 3. This response will fail when channel doesn't exist (doesn't have any member)

#### WHOAMI

If you want, get the connection ID.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.WhoAmI;

const response = await service.send({
    type: REQUEST_TYPE,
});

console.log(`Status: ${response.success}`);
console.log(`ID: ${response.id}`);
```

#### CONNECTIONS

If you want, get the all the connections.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Connections;

const response = await service.send({
    type: REQUEST_TYPE,
});

console.log(`Status: ${response.success}`);

response.connections.forEach((item) => {
    console.log(`ID: ${item.id}`)
    console.log(`Type: ${item.type}`)
    console.log(`Kind: ${item.kind}`)
    console.log(`IP Version: ${item.ip_version}`)
    console.log(`IP: ${item.ip}`)
    console.log(`Port: ${item.port}`)
    console.log(`Connected At: ${item.connected_at}`)
    console.log(`Read Bytes: ${item.read_bytes}`)
    console.log(`Write Bytes: ${item.write_bytes}`)
    console.log(`Publish Bytes: ${item.publish_bytes}`)
    console.log(`Received Bytes: ${item.received_bytes}`)
    console.log(`Allocated Bytes: ${item.allocated_bytes}`)
    console.log(`Consumed Bytes: ${item.consumed_bytes}`)
    console.log(`INSERT Requests: ${item.insert_requests}`)
    console.log(`SET Requests: ${item.set_requests}`)
    console.log(`QUERY Requests: ${item.query_requests}`)
    console.log(`UPDATE Requests: ${item.update_requests}`)
    console.log(`PURGE Requests: ${item.purge_requests}`)
    console.log(`LIST Requests: ${item.list_requests}`)
    console.log(`INFO Requests: ${item.info_requests}`)
    console.log(`STAT Requests: ${item.stat_requests}`)
    console.log(`STATS Requests: ${item.stats_requests}`)
    console.log(`PUBLISH Requests: ${item.publish_requests}`)
    console.log(`SUBSCRIBE Requests: ${item.subscribe_requests}`)
    console.log(`UNSUBSCRIBE Requests: ${item.unsubscribe_requests}`)
    console.log(`CONNECTION Requests: ${item.connection_requests}`)
    console.log(`CONNECTIONS Requests: ${item.connections_requests}`)
    console.log(`CHANNEL Requests: ${item.channel_requests}`)
    console.log(`CHANNELS Requests: ${item.channels_requests}`)
    console.log(`WHOAMI Requests: ${item.whoami_requests}`)
});
```

#### CONNECTION

If you want, get the specific connections.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Connection;
const ID = "7bb4b6ce32f54c32835b7b3e86a368fe";

const response = await service.send({
    type: REQUEST_TYPE,
    id: ID,
});

console.log(`Status: ${response.success}`);

console.log(`ID: ${response.id}`)
console.log(`Type: ${response.type}`)
console.log(`Kind: ${response.kind}`)
console.log(`IP Version: ${response.ip_version}`)
console.log(`IP: ${response.ip}`)
console.log(`Port: ${response.port}`)
console.log(`Connected At: ${response.connected_at}`)
console.log(`Read Bytes: ${response.read_bytes}`)
console.log(`Write Bytes: ${response.write_bytes}`)
console.log(`Publish Bytes: ${response.publish_bytes}`)
console.log(`Received Bytes: ${response.received_bytes}`)
console.log(`Allocated Bytes: ${response.allocated_bytes}`)
console.log(`Consumed Bytes: ${response.consumed_bytes}`)
console.log(`INSERT Requests: ${response.insert_requests}`)
console.log(`SET Requests: ${response.set_requests}`)
console.log(`QUERY Requests: ${response.query_requests}`)
console.log(`UPDATE Requests: ${response.update_requests}`)
console.log(`PURGE Requests: ${response.purge_requests}`)
console.log(`LIST Requests: ${response.list_requests}`)
console.log(`INFO Requests: ${response.info_requests}`)
console.log(`STAT Requests: ${response.stat_requests}`)
console.log(`STATS Requests: ${response.stats_requests}`)
console.log(`PUBLISH Requests: ${response.publish_requests}`)
console.log(`SUBSCRIBE Requests: ${response.subscribe_requests}`)
console.log(`UNSUBSCRIBE Requests: ${response.unsubscribe_requests}`)
console.log(`CONNECTION Requests: ${response.connection_requests}`)
console.log(`CONNECTIONS Requests: ${response.connections_requests}`)
console.log(`CHANNEL Requests: ${response.channel_requests}`)
console.log(`CHANNELS Requests: ${response.channels_requests}`)
console.log(`WHOAMI Requests: ${response.whoami_requests}`)
```

#### CHANNELS

If you want, get the all the channels.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Channels;

const response = await service.send({
    type: REQUEST_TYPE,
});

console.log(`Status: ${response.success}`);

response.channels.forEach((item) => {
    console.log(`Channel: ${item.channel}`)
    console.log(`Read Bytes: ${item.read_bytes}`)
    console.log(`Write Bytes: ${item.write_bytes}`)
    console.log(`Connections: ${item.connections}`)
});
```


#### CHANNEL

If you want, get the specific channel.

```typescript
import { RequestType } from '@throttr/sdk';

const REQUEST_TYPE = RequestType.Channel;
const CHANNEL = "*";

const response = await service.send({
    type: REQUEST_TYPE,
    channel: CHANNEL,
});

console.log(`Status: ${response.success}`);

response.connections.forEach((item) => {
    console.log(`ID: ${item.id}`)
    console.log(`Subscribe At: ${item.subscribe_at}`)
    console.log(`Read Bytes: ${item.read_bytes}`)
    console.log(`Write Bytes: ${item.write_bytes}`)
});
```

### Get Disconnected

Once your operations has been finished, you could release resources using:

```typescript
service.disconnect();
```

See all the commands available on the examples located in [tests](https://github.com/throttr/typescript/blob/master/tests/service.test.ts).

## Advanced Usage

I will show you my recommended usages as previous requests are just raw protocol.

### Optimized Rate Limiter

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
- The package is defined to works with protocol 5.0.11 or greatest.

---

## License

Distributed under the [GNU Affero General Public License v3.0](https://github.com/throttr/typescript/blob/master/LICENSE).