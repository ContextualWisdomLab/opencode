ARG REGISTRY=ghcr.io/anomalyco
FROM ${REGISTRY}/build/rust:24.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libappindicator3-dev \
    libwebkit2gtk-4.1-dev \
    librsvg2-dev \
    patchelf \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 10001 tauri \
  && useradd --uid 10001 --gid 10001 --create-home --shell /bin/bash tauri

ENV HOME=/home/tauri \
  CARGO_HOME=/home/tauri/.cargo \
  BUN_INSTALL_CACHE_DIR=/home/tauri/.cache/bun

USER tauri:tauri
