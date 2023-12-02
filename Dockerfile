FROM rust:1.74.0-alpine3.18 as tokenizer

RUN apk update && apk add git musl-dev && rm -rf /var/cache/apt/*
RUN mkdir work && cd work && git init && git remote add origin https://github.com/mechairoi/Signal-FTS5-Extension.git && git fetch --depth 1 origin 0f9583a93bb3a16f498a3506937a37e2a5503851 && git checkout FETCH_HEAD

WORKDIR /work
RUN RUSTFLAGS="-C target-feature=-crt-static" cargo rustc --features extension --release -- --crate-type=cdylib
RUN cp target/release/deps/libsignal_tokenizer-*.so libsignal_tokenizer.so

FROM oven/bun:1.0.14-alpine AS bun-base
RUN apk update && apk add bash fuse3 sqlite ca-certificates && rm -rf /var/cache/apk/*
WORKDIR /app

FROM bun-base AS bun-deps
COPY package.json bun.lockb /app/
RUN bun install --frozen-lockfile --production

FROM bun-deps AS bun-test
RUN bun install --frozen-lockfile
COPY --from=tokenizer /work/libsignal_tokenizer.so /app/lib/libsignal_tokenizer.so
ADD app.ts app.spec.ts index.html .

FROM bun-deps AS bun-runner
COPY --from=flyio/litefs:0.5.9 /usr/local/bin/litefs /usr/local/bin/litefs
RUN mkdir -p /litefs /var/lib/litefs
COPY --from=tokenizer /work/libsignal_tokenizer.so /app/lib/libsignal_tokenizer.so
ADD index.ts app.ts start.sh index.html .
ADD litefs.yml /etc/litefs.yml

EXPOSE 8080
ENV DB_PATH=/litefs/main.db
ENV PORT="8081"

ENTRYPOINT [ "litefs", "mount" ]
