ARG REGISTRY=ghcr.io/anomalyco
FROM ${REGISTRY}/build/rust:24.04

USER root

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libappindicator3-dev \
    libwebkit2gtk-4.1-dev \
    librsvg2-dev \
    patchelf \
  && rm -rf /var/lib/apt/lists/*

ENV CARGO_HOME=/home/build_agent/.cargo \
  BUN_INSTALL_CACHE_DIR=/home/build_agent/.cache/bun

USER build_agent:build_agent
