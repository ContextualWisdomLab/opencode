# Shared build-container non-root hierarchy repair

## Problem and evidence

OpenCode PR #2 Security Scan run `36848110099`, job `110323068088`, reports
Trivy `DS-0002` for the published `base`, `bun-node`, `rust`, and `publish`
Dockerfiles. PR #5 repaired the Tauri leaf with UID/GID 10001, but that local
account becomes a hierarchy conflict as soon as a parent image owns the same
fixed identity.

Two failures share one cause: the image chain had no canonical owner for its
runtime identity. Independent account creation would collide in descendants,
while simply adding `USER` to a parent would make child `apt-get`, Node/Bun, and
Rust provisioning execute without the authority they require.

## Constraints and decision

The five images are independently published but form one ordered build chain:
`base` → `bun-node` → `rust` → `tauri-linux`, with `publish` branching from
`bun-node`. The repair must keep build tools readable, keep mutable dependency
caches writable, avoid recursive ownership layers, and fail closed if a child
forgets either provisioning elevation or final privilege removal.

The selected design makes `base` the single owner of fixed UID/GID 10001
`build_agent` and `/home/build_agent`. Each child explicitly uses `USER root`
before its first provisioning `RUN` and restores `USER build_agent:build_agent`
as its final instruction. Bun and Cargo caches move under the shared home while
the immutable toolchains remain root-owned under `/opt` and `/usr/local`.

Rejected alternatives:

- separate fixed users per image preserve avoidable identity drift and still
  require explicit privilege transitions in every descendant;
- reusing the PR #5 `tauri` name in shared parents gives a leaf domain term
  authority over unrelated Rust, Bun/Node, and publication jobs;
- making toolchain directories recursively user-owned expands mutation
  authority and adds a large metadata-only layer;
- leaving children implicitly root depends on the current parent default and
  breaks as soon as the parent is correctly hardened.

## RED, repair, and verification

On PR #5 exact head `699f1408dae65120f5b88caa77359dff1c22d699`,
the executable hierarchy contract failed all three behaviors: no base-owned
account, no common final user across all five images, and no explicit child
elevation before provisioning. Source repair commit
`3b1f19abdc7b6fef3b5bae4fe9e4a943188e38bf` repaired the production files.
Exact-head review then proved that the first hierarchy oracle accepted account
and root-transition evidence placed only in a discarded stage. The bypass was
RED at `0ee9c6501450d7875c04c6a82719061d9699872b`; oracle repair commit
`6fb3f1fc0d3f0572c454a3ae8e61b9ddf59715c7` restricts every predicate to the
final stage. The Bun 1.3.14 focused suite is GREEN: **7 passed, 0 failed, 16
assertions**, including the retained Tauri inert-stage case.

No local Docker or Podman runtime is available, so image-build and scanner
success are not claimed. PR #6 remains **Draft / Proposed / merge HOLD** until
its prerequisites integrate ordinarily and fresh exact-head build,
Trivy/Semgrep, product Checks, resolved threads, and qualifying independent
approval are acceptable.

## Exact-head build admission repair

Review of the acceptance path found that `.github/workflows/containers.yml`
only listened to `push` and `workflow_dispatch`, while PR #6 required a hosted
image build before merge. The gate therefore could not materialize on any pull
request head. Reusing the existing build script with `--push` was also unsafe:
it would ask a pull-request token to authenticate and publish to GHCR.

The workflow contract was RED because it found no pull-request path, no
build-only step, and no stale-run concurrency group. Repair commit
`d528e665a2d4d311592db1b2ab84a1c42ae07428` runs the same script with
`PUSH=0` on pull requests, skips GHCR login there, preserves `PUSH=1` for
`dev`/manual publication, and cancels superseded revisions. Focused Bun 1.3.14
verification is **9 passed, 0 failed, 22 assertions** across the workflow,
hierarchy, and Tauri contracts. A fresh hosted run on the successor exact head
is still required; this source repair is not hosted build evidence by itself.

## User, operations, and failure scenes

A CI job consuming any published image starts as `build_agent`, can populate
its home-owned dependency caches, and cannot mutate root-owned toolchains. A
Dockerfile maintainer adding a provisioning step must explicitly enter the
root section and still restore the final non-root user. If either edge is
removed, the hierarchy regression fails before publication; hosted image builds
and scanners remain the acceptance boundary for real package-manager behavior.
