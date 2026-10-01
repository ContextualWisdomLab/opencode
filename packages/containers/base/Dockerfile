FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    git \
    jq \
    openssh-client \
    pkg-config \
    python3 \
    unzip \
    xz-utils \
    zip \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 10001 build_agent \
  && useradd --uid 10001 --gid 10001 --create-home --shell /bin/bash build_agent

ENV HOME=/home/build_agent

USER build_agent:build_agent
