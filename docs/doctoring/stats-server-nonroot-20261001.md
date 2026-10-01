# Stats server non-root runtime repair

## Incident

OpenCode PR #2 Security Scan run `36848110099`, job `110323068088`, reported
Trivy `DS-0002` at `packages/stats/server/Dockerfile:1`. SAST run
`36848110084`, job `110323025333`, independently reported
`dockerfile.security.missing-user.missing-user` at line 32. The final stage had
no `USER`, so the stats HTTP server started with the base image's root
identity.

## Root cause and boundary

The stats server Dockerfile owned its runtime identity but defined only build
and application startup instructions. The server binds an unprivileged port,
does not write application files during startup, and already disables Bun's
runtime transpiler cache. The repair therefore belongs to the independently
deployed stats server image; changing the shared security workflow or masking
the scanner result would not correct the runtime authority.

## Repair

The base stage creates the dedicated `stats` account with fixed UID/GID 10001
and home `/home/stats`. The final stage selects `USER stats:stats`, exports that
home, and then starts the existing command. Application files remain
root-owned and read-only to the runtime identity because no product write path
requires a recursive ownership change.

An executable production-file contract requires both account-creation
instructions and the exact final `USER`, `HOME`, and `CMD` sequence. Before the
Dockerfile change it failed with an empty account-instruction set; after the
change it passes with Bun 1.3.14.

## Acceptance and residual risk

This source repair is **Proposed**. A fresh exact-head hosted image build,
Trivy, Semgrep, normal product Checks, and qualifying independent approval are
required before ordinary merge. No local container runtime or Trivy executable
was available, so local image-build or scanner success is not claimed.

The five `packages/containers/*` images and the vulnerable lockfile inputs are
separate owners and remain Open Gap work. They are not suppressed or bundled
into this bounded repair.
