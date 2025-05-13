# Java

Java client for communicating with a [Throttr Server](https://github.com/throttr/throttr).

The SDK enables [in-memory data objects](https://en.wikipedia.org/wiki/In-memory_database) and [rate limiting](https://en.wikipedia.org/wiki/Rate_limiting) efficiently, only using TCP, respecting the server's native binary protocol.

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

### As Rate Limiter

```java
package your.source;

import cl.throttr.Service;
import cl.throttr.enums.ValueSize;
import cl.throttr.requests.InsertRequest;
import cl.throttr.requests.QueryRequest;
import cl.throttr.requests.UpdateRequest;
import cl.throttr.requests.PurgeRequest;
import cl.throttr.enums.TTLType;
import cl.throttr.enums.AttributeType;
import cl.throttr.enums.ChangeType;
import cl.throttr.responses.QueryResponse;
import cl.throttr.responses.StatusResponse;

public class RateLimiter {

    public static void main(String[] args) {
        Service service = new Service("127.0.0.1", 9000, ValueSize.UINT16, 1);
        service.connect();

        String key = UUID.randomUUID().toString();

        // INSERT with quota=7 and ttl=60
        StatusResponse insert = (StatusResponse) service.send(new InsertRequest(7, TTLType.SECONDS, 60, key));
        System.out.println("Insert has been success: " + insert.success());

        // QUERY and validate
        QueryResponse q1 = (QueryResponse) service.send(new QueryRequest(key));
        System.out.println("Key exists: " + q1.success());
        System.out.println("Quota is 7: " + q1.quota() == 7);
        System.out.println("TTL type is seconds: " + q1.ttlType() == TTLType.SECONDS);
        System.out.println("TTL is between 0 and 60: " + (q1.ttl() > 0 && q1.ttl() < 60));

        // UPDATE: DECREASE quota by 7
        StatusResponse dec1 = (StatusResponse) service.send(new UpdateRequest(AttributeType.QUOTA, ChangeType.DECREASE, 7, key));
        System.out.println("Quota has been decreased: " + dec1.success());

        // UPDATE: DECREASE quota again -> should fail
        StatusResponse dec2 = (StatusResponse) service.send(new UpdateRequest(AttributeType.QUOTA, ChangeType.DECREASE, 7, key));
        System.out.println("Quota has been decreased: " + dec2.success());

        // QUERY -> quota should be 0
        QueryResponse q2 = (QueryResponse) service.send(new QueryRequest(key));
        System.out.println("Quota is 0: " + q2.quota() == 0);

        // UPDATE: PATCH quota to 10
        StatusResponse patchQuota = (StatusResponse) service.send(new UpdateRequest(AttributeType.QUOTA, ChangeType.PATCH, 10, key));
        System.out.println("Quota has been patched: " + patchQuota.success());

        // QUERY -> quota should be 10
        QueryResponse q3 = (QueryResponse) service.send(new QueryRequest(key));
        System.out.println("Quota is 10: " + q3.quota() == 10);

        // UPDATE: INCREASE quota by 20 -> should be 30
        StatusResponse incQuota = (StatusResponse) service.send(new UpdateRequest(AttributeType.QUOTA, ChangeType.INCREASE, 20, key));
        System.out.println("Quota has been increased: " + incQuota.success());

        // QUERY -> quota should be 30
        QueryResponse q4 = (QueryResponse) service.send(new QueryRequest(key));
        System.out.println("Quota is equals to 30: " + q4.quota() == 30);

        // UPDATE: INCREASE TTL by 60 -> ttl > 60 and < 120
        StatusResponse incTtl = (StatusResponse) service.send(new UpdateRequest(AttributeType.TTL, ChangeType.INCREASE, 60, key));
        System.out.println("TTL has been increased: " + incTtl.success());

        QueryResponse q5 = (QueryResponse) service.send(new QueryRequest(key));
        System.out.println("TTL is between 60 and 120: " + (q5.ttl() > 60 && q5.ttl() < 120));

        // UPDATE: DECREASE TTL by 60 -> ttl < 60
        StatusResponse decTtl = (StatusResponse) service.send(new UpdateRequest(AttributeType.TTL, ChangeType.DECREASE, 60, key));
        System.out.println("TTL has been decrease: " + decTtl.success());

        QueryResponse q6 = (QueryResponse) service.send(new QueryRequest(key));
        System.out("TTL is between 0 and 60: " + (q6.ttl() > 0 && q6.ttl() < 60));

        // UPDATE: PATCH TTL to 90 -> ttl ~90
        StatusResponse patchTtl = (StatusResponse) service.send(new UpdateRequest(AttributeType.TTL, ChangeType.PATCH, 90, key));
        System.out("TTL has been patched: " + patchTtl.success());

        QueryResponse q7 = (QueryResponse) service.send(new QueryRequest(key));
        System.out.println("TTL is between 60 and 90" + (q7.ttl() > 60 && q7.ttl() <= 90));

        // PURGE
        StatusResponse purge = (StatusResponse) service.send(new PurgeRequest(key));
        System.out.println("Key has been purged: " + purge.success());

        service.close();
    }
}
```

### As Database

```java
import cl.throttr.Service;
import cl.throttr.enums.ValueSize;
import cl.throttr.requests.SetRequest;
import cl.throttr.requests.GetRequest;
import cl.throttr.requests.PurgeRequest;
import cl.throttr.enums.TTLType;
import cl.throttr.responses.GetResponse;
import cl.throttr.responses.StatusResponse;

public class InMemoryDatabase {

    public static void main(String[] args) {
        Service service = new Service("127.0.0.1", 9000, ValueSize.UINT16, 1);
        service.connect();

        String key = UUID.randomUUID().toString();
        String value = "EHLO";
        int ttl = 30;

        StatusResponse set = (StatusResponse) service.send(new SetRequest(TTLType.SECONDS, ttl, key, value));
        System.out.println("EHLO has been set " + set.success());

        GetResponse get = (GetResponse) service.send(new GetRequest(key));
        System.out.println("Value is: " + new String(get.value())); // Must be EHLO
    }
}
```

See more examples in [tests](https://github.com/throttr/java/blob/master/src/test/java/cl/throttr/ServiceTest.java).

## Technical Notes

- The protocol assumes Little Endian architecture.
- The internal message queue ensures requests are processed sequentially.
- The package is defined to works with protocol 4.0.14 or greatest.

---

## License

Distributed under the [GNU Affero General Public License v3.0](https://github.com/throttr/java/blob/master/LICENSE).