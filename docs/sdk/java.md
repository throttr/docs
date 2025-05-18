# Java

## Installation

Add the dependency to your `pom.xml`:

```xml
<dependency>
    <groupId>cl.throttr</groupId>
    <artifactId>sdk</artifactId>
    <version>4.0.0</version>
</dependency>
```

Make sure to configure your Maven repositories to include GitHub Packages if needed.

## Basic Usage

### Get Connected

Use the Service to create a communication channel between your application and Throttr server.

```java
import cl.throttr.enums.*;
import cl.throttr.requests.*;
import cl.throttr.responses.*;

String HOST = "127.0.0.1";
int PORT = 9000;
int MAX_CONNECTIONS = 4;
ValueSize DYNAMIC_VALUE_SIZE = ValueSize.UINT16;

Service service = new Service(
    HOST,
    PORT, 
    DYNAMIC_VALUE_SIZE, 
    MAX_CONNECTIONS
);
 
service.connect();
```

After that, `service` will be a instance that can be used in concurrently.

Every connection contained in service has his own requests resolve promise queue. This guarantees
that every single request make against the server will be resolved one by one. Even, if you sent it as batch.

Requests **can fail**, mainly, for external causes. I/O, Network stability and so on. Using `try / catch` is recommended.

### Sending Requests

The following operations are based in Throttr protocol `v5.0.0`.

#### INSERT

If you want to create a `counter` to track requests or metrics. Then `INSERT` is for you.

```java
import cl.throttr.enums.*;
import cl.throttr.requests.*;
import cl.throttr.responses.*;

String KEY = "NON_EXISTING_KEY";
int QUOTA = 5;
int TTL = 60;
TTLType TTL_TYPE = TTLType.SECONDS;

StatusResponse response = service.send(
    new InsertRequest(
        QUOTA,
        TTL_TYPE,
        TTL,
        KEY
    )
);

System.out.println("Status: " + response.success());
```

There are only one condition that `success` can be `false`, and is, when the `key` already exists.

#### QUERY

If you want to recover the `counter` value or TTL specification. Then `QUERY` is for you.

```java
import cl.throttr.enums.*;
import cl.throttr.requests.*;
import cl.throttr.responses.*;

String KEY = "EXISTING_KEY";

QueryResponse response = service.send(
    new QueryRequest(
        KEY
    )
);

System.out.println("Status: " + response.success());
System.out.println("Quota: " + response.quota());
System.out.println("TTL Type: " + response.ttlType());
System.out.println("TTL: " + response.ttl());
```

There are only one condition that `success` can be `false`, and is, when the `key` doesn't exist.

In that case, `quota`, `ttl` and `ttlType` will contain `invalid` values.

#### UPDATE

If you want to modify the `counter` value or TTL. Then `UPDATE` is for you.

```java
import cl.throttr.enums.*;
import cl.throttr.requests.*;
import cl.throttr.responses.*;

String KEY = "EXISTING_KEY";
int VALUE = 5;
AttributeType ATTRIBUTE_TYPE = AttributeType.QUOTA;
ChangeType CHANGE_TYPE = ChangeType.DECREASE;

StatusResponse response = service.send(
    new UpdateRequest(
        ATTRIBUTE_TYPE,
        CHANGE_TYPE,
        VALUE,
        KEY
    )
);

System.out.println("Status: " + response.success());
```

There are two attributes that can be modified `Quota` and `TTL`.

There are three change type that can be invoked:

- `PATCH` to replace the value.
- `INCREASE` to extend the quota or increase the metric.
- `DECREASE` to consume the quota or decrease the metric.

There are two different cases that `success` can be `false`:

- `Key` doesn't exists.
- `Quota` is less than the value that want to be reduced. IE: Quota is 20, but you want to `DECREASE` 50.

The last case is relevant because you can combine `INSERT` + `UPDATE` as pattern.

#### PURGE

If you want, manually, remove the `counter` or `buffer`. Then `PURGE` is for you.

```java
import cl.throttr.enums.*;
import cl.throttr.requests.*;
import cl.throttr.responses.*;

String KEY = "EXISTING_KEY";

StatusResponse response = service.send(
    new PurgeRequest(
        KEY
    )
);

System.out.println("Status: " + response.success());
```

There are only one condition that `success` can be `false`, and is, when the `key` doesn't exist.

#### SET

If you want, create a `buffer` (arbitrary data in memory). Then `SET` is for you.

```java
import cl.throttr.enums.*;
import cl.throttr.requests.*;
import cl.throttr.responses.*;

String KEY = "NON_EXISTING_KEY";
String VALUE = "EHLO";
int TTL = 24;
TTLType TTL_TYPE = TTLType.HOURS;

StatusResponse response = service.send(
    new SetRequest(
        TTL_TYPE,
        TTL,
        KEY,
        VALUE
    )
);

System.out.println("Status: " + response.success());
```

There are only one condition that `success` can be `false`, and is, when the `key` already exist.

#### GET

If you want, recover a `buffer`. Then `GET` is for you.

```java
import cl.throttr.enums.*;
import cl.throttr.requests.*;
import cl.throttr.responses.*;

String KEY = "EXISTING_KEY";

GetResponse response = service.send(
    new GetRequest(
        KEY
    )
);

System.out.println("Status: " + response.success());
System.out.println("TTL Type: " + response.ttlType());
System.out.println("TTL: " + response.ttl());
System.out.println("Value: " + response.value());
```

There are only one condition that `success` can be `false`, and is, when the `key` doesn't exist.

### Get Disconnected

Once your operations has been finished, you could release resources using:

```php
service.close();
```

## Advanced Usage

I will show you my recommended usages as previous requests are just raw protocol.

### Optimized Rate Limiter

Avoid the usage of `INSERT` and `UPDATE` as two separated requests. Call it as `batch`.

The `send` function also receives `List`. This reduces two TCP message to only one.

This mechanism provides to you enough information to `allow` or `block` a request.

```java
import cl.throttr.enums.*;
import cl.throttr.requests.*;
import cl.throttr.responses.*;

String KEY = "127.0.0.1:8000,GET,/api/user";
int QUOTA = 5;
int TTL = 60;
TTLType TTL_TYPE = TTLType.SECONDS;
AttributeType ATTRIBUTE_TYPE = AttributeType.QUOTA;
ChangeType CHANGE_TYPE = ChangeType.DECREASE;
int CONSUME = 1;

List<StatusResponse> responses = service.send(
    List.of(
        new InsertRequest(
            QUOTA,
            TTL_TYPE,
            TTL,
            KEY
        ),
        new UpdateRequest(
            ATTRIBUTE_TYPE,
            CHANGE_TYPE,
            CONSUME,
            KEY
        )
    )
);

System.out.println("INSERT: " + responses.get(0).success());
System.out.println("UPDATE: " + responses.get(1).success());
```

If `INSERT` was `success` then is the first consume time and if `UPDATE` was `success` then the user had available quota.

See more examples in [tests](https://github.com/throttr/java/blob/master/src/test/java/cl/throttr/ServiceTest.java).

## Technical Notes

- The protocol assumes Little Endian architecture.
- The internal message queue ensures requests are processed sequentially.
- The package is defined to works with protocol 4.0.14 or greatest.

---

## License

Distributed under the [GNU Affero General Public License v3.0](https://github.com/throttr/typescript/blob/master/LICENSE).