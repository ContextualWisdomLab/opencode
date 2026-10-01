# GLM 5.2 video dependency doctoring

Date: 2026-10-02

Status: Proposed; source repaired, exact-head hosted Security Scan pending.

## Problem and evidence

OpenCode PR #2 Security Scan run `36848110099`, job `110323068088`, checked
exact revision `9d05f4f11fbd48cd909e5355591a66563010ff12` and reported fifteen findings
in `artifacts/glm52-rise-video/bun.lock`:

- `baseline-browser-mapping@2.10.40`: CVE-2026-45819.
- `browserslist@4.28.4`: CVE-2026-73088 and CVE-2026-73089.
- `fast-uri@3.1.2`: CVE-2026-13676, CVE-2026-16221, CVE-2026-18446,
  CVE-2026-75899, CVE-2026-75975, CVE-2026-76172, CVE-2026-84292, and
  CVE-2026-86472.
- `nanoid@3.3.15`: CVE-2026-67213 and CVE-2026-67214.
- `postcss@8.5.15`: CVE-2026-73646 and CVE-2026-69153.

`bun pm why` traced the five packages to the artifact's existing
Remotion/bundler/webpack graph. They are transitive dependencies, not a shared
runtime service or a new product boundary. The artifact manifest already
declared `@remotion/cli` and `remotion` as `^4.0.384`; its stale lock selected
the vulnerable graph.

## Decision

Regenerate only the artifact's canonical `bun.lock` with Bun 1.3.14 from the
unchanged `package.json`. Do not add overrides, duplicate transitive packages
as direct dependencies, or copy another owner's lock. The fresh graph selects
Remotion 4.0.532 and these minimum repaired versions:

| Package | Before | After / regression floor |
| --- | ---: | ---: |
| `baseline-browser-mapping` | 2.10.40 | 2.11.27 |
| `browserslist` | 4.28.4 | 4.29.3 |
| `fast-uri` | 3.1.2 | 3.1.8 |
| `nanoid` | 3.3.15 | 3.3.19 |
| `postcss` | 8.5.15 | 8.5.28 |

The regression reads the production lock, checks every resolved occurrence
with Bun's semver implementation, and throws if an expected package is absent.
A duplicate-version fixture proves that nested lock keys are enumerated. This
prevents a downgrade, a hidden vulnerable duplicate, and a vacuous pass caused
by an unexpected lock shape.

## Executable evidence

Before regeneration, the focused test failed on
`baseline-browser-mapping@2.10.40` (one pass, one failure). After regeneration:

- focused dependency regression: 3 tests, 7 assertions, all passing;
- complete `packages/opencode/test/security` directory: 10 tests,
  16 assertions, all passing;
- `bun install --frozen-lockfile`: 248 packages installed successfully;
- Remotion bundled `src/index.tsx` successfully in 6.121 seconds.

Composition discovery then stopped in the execution sandbox when Node's
`os.networkInterfaces()` returned `uv_interface_addresses` error 1. An ad hoc
TypeScript command also exposed two existing `hero` union-property errors in
`src/video.tsx`; this lock-only security delta does not relabel either result
as passing or widen scope to unrelated source repair.

No local Bun security scanner is configured, and no Trivy executable is
available. Therefore the repaired versions are source evidence, not a claim
that the CVEs are closed. A fresh hosted Security Scan bound to the exact PR
head remains the authoritative completion gate.

## Risks and follow-up

The lock refresh moves the artifact to later minor and patch releases admitted
by its existing manifest. The frozen install and bundle reduce compatibility
risk, but hosted build and scanner evidence must still be reviewed. Keep the
PR Draft until its parent stack is integrated and the exact-head checks are
terminal GREEN; do not bypass or manually rerun queued checks.
