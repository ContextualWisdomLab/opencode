FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS base

# Disable the runtime transpiler cache by default inside Docker containers.
# On ephemeral containers, the cache is not useful
ARG BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=${BUN_RUNTIME_TRANSPILER_CACHE_PATH}
RUN apk add --no-cache libgcc libstdc++ ripgrep
RUN addgroup -S -g 10001 opencode \
    && adduser -S -D -u 10001 -G opencode -h /home/opencode opencode

FROM scratch AS runtime-binaries
COPY dist/opencode-linux-x64-baseline-musl/bin/opencode /amd64/opencode
COPY dist/opencode-linux-arm64-musl/bin/opencode /arm64/opencode

FROM base AS runtime
ARG TARGETARCH
RUN --mount=type=bind,from=runtime-binaries,source=/,target=/tmp/opencode-binaries \
    case "${TARGETARCH}" in amd64|arm64) ;; *) exit 64 ;; esac \
    && cp "/tmp/opencode-binaries/${TARGETARCH}/opencode" /usr/local/bin/opencode \
    && chmod 0755 /usr/local/bin/opencode \
    && opencode --version
USER opencode:opencode
ENV HOME=/home/opencode
ENTRYPOINT ["opencode"]
