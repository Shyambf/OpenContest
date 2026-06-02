FROM golang:1.22-alpine AS build

WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN go mod tidy
RUN go build -o /runner .

FROM debian:bookworm-slim AS nsjail-build

ARG NSJAIL_REF=master
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        autoconf \
        bison \
        ca-certificates \
        flex \
        g++ \
        gcc \
        git \
        libnl-route-3-dev \
        libprotobuf-dev \
        libseccomp-dev \
        libtool \
        make \
        pkg-config \
        protobuf-compiler \
    && git clone --depth=1 --branch "${NSJAIL_REF}" https://github.com/google/nsjail.git /src/nsjail \
    && make -C /src/nsjail \
    && strip /src/nsjail/nsjail \
    && /src/nsjail/nsjail --help >/dev/null

FROM debian:bookworm-slim
COPY languages /app/languages
COPY setup_env.sh /app/setup_env.sh
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libnl-route-3-200 \
    libprotobuf32 \
    libseccomp2 \
    jq \
    && chmod +x /app/setup_env.sh \
    && cd /app && ./setup_env.sh \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /runner /usr/local/bin/opencontest-runner
COPY --from=nsjail-build /src/nsjail/nsjail /usr/local/bin/nsjail
COPY languages /app/languages
WORKDIR /app
ENV NSJAIL_BIN=/usr/local/bin/nsjail
ENV LANGUAGES_DIR=/app/languages
CMD ["opencontest-runner"]
