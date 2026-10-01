# Tauri Linux build-container non-root repair

## Incident

OpenCode PR #2 Security Scan run `36848110099`, job `110323068088`, reported
Trivy `DS-0002` for `packages/containers/tauri-linux/Dockerfile`. The published
build image inherited the root identity from `build/rust:24.04` and never
selected a narrower runtime user.

## Root cause and boundary

The leaf Tauri Linux image owns the Linux desktop packages and the authority
used by Tauri build jobs. It added those packages but omitted a runtime identity
contract. A bare final `USER` would be incomplete: inherited `CARGO_HOME` and
Bun's installation cache assumed root-writable toolchain prefixes, so ordinary
dependency resolution could fail after privilege removal.

The repair stays at the independently published `tauri-linux` boundary. It
does not change the shared base, Bun/Node, Rust, or publishing images, and it
does not mask their remaining scanner findings.

## RED and repair

At stacked parent `b65227ac6c3c4bfa830ad1b7964b9d8807104e21`, the new production-file
contract failed both assertions: no fixed non-root identity existed, and the
mutable package caches were not redirected to a writable home.

Repair commit `0606bcc58384a4bb92192e5d4b785afefe428dec` creates `tauri` with
fixed UID/GID 10001 and `/home/tauri`, moves `CARGO_HOME` and
`BUN_INSTALL_CACHE_DIR` under that home, and makes `USER tauri:tauri` the final
instruction. The inherited `/opt` toolchains remain root-owned and executable;
avoiding recursive ownership changes prevents a large metadata-only image
layer.

## Verification and acceptance

Bun 1.3.14 reports **2 passed, 0 failed, 6 assertions** and `git diff --check`
is clean. No Docker or Podman runtime is available locally, so image-build and
scanner success are not claimed.

PR #5 remains **Draft / Proposed / merge HOLD**. Fresh exact-head build,
Trivy/Semgrep, full product Checks, resolved review threads, and qualifying
independent review are required before ordinary merge. The `base`, `bun-node`,
`publish`, and `rust` runtime identities remain Open Gap work.
