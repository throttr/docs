# Get Started

## Run the Server

There are a different ways to get Throttr Server running.

### Using Binaries

This is the most easy and fast way to get an instance ready to accept connections and handle requests.

The first step is go to the [Throttr Server Repository][] and click on `Releases`.

![Assets per release](/images/releases-assets.png)

Download and extract it. You can run it by using the following command:

```bash
./throttr --port=9000 --threads=4
```

### Using Docker

This is the most easy and fast way to get 

```bash
// For Quotas/TTL and Buffers

// Upto 255
docker run -p 9000:9000 ghcr.io/throttr/throttr:4.0.17-debug-uint8

// Upto 65.535
docker run -p 9000:9000 ghcr.io/throttr/throttr:4.0.17-debug-uint16

// Upto 4.294.967.295
docker run -p 9000:9000 ghcr.io/throttr/throttr:4.0.17-debug-uint32

// Upto 2^64 - 1
docker run -p 9000:9000 ghcr.io/throttr/throttr:4.0.17-debug-uint64
```

### Building from Source

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

Now you should find `throttr` binary inside build folder and that's all folks.

## Software Development Kit's

We have the following SDK's available:


| Repository             | Documentation           |
|------------------------|-------------------------|
| [SDK for TypeScript][] | [TS: Read the docs][]   |
| [SDK for PHP][]        | [PHP: Read the docs][]  |
| [SDK for Java][]       | [Java: Read the docs][] |
| [SDK for C++][]        | [C++: Read the docs][]  |


[Throttr Server Repository]: https://github.com/throttr/throttr
[SDK for TypeScript]: https://github.com/throttr/typescript
[SDK for PHP]: https://github.com/throttr/php
[SDK for Java]: https://github.com/throttr/java
[SDK for C++]: https://github.com/throttr/cpp
[TS: Read the docs]: ./sdk/typescript.md
[PHP: Read the docs]: ./sdk/php.md
[Java: Read the docs]: ./sdk/java.md
[C++: Read the docs]: ./sdk/cpp.md