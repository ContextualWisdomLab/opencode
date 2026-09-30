# OpenCode runtime image apk cache RCA

## Status

Proposed source repair. Merge, release, and deployment remain blocked on fresh
exact-head Checks and qualifying independent review.

## Failure evidence

OpenCode PR #1 exact head `2aa4a9cf057096b27427dd406e136bcb37099780`
was scanned by Security Scan run `36358142730`, job `109060466385`. Trivy
reported `DS-0025` at `packages/opencode/Dockerfile:7` because the runtime
image used `apk add libgcc libstdc++ ripgrep` without apk's `--no-cache`
option. This retains the downloaded repository index in the image layer and is
independent of the PR's one-line workflow delta.

## Root cause and repair

The canonical OpenCode runtime image owned the package-install instruction.
The smallest repair adds apk's native `--no-cache` option at that boundary;
package selection, image stages, entrypoint, and application behavior are
unchanged. A package-level regression selects the canonical physical
`RUN apk add` instruction and requires the exact intended package set plus
apk's `--no-cache` option. It deliberately does not emulate Docker or POSIX
shell parsing. Trivy remains the independent whole-tree semantic scanner for
the published exact head.

RED was reproduced against protected `dev@b3f1a96c6dd7adeb28b36dd11add1998fc84d67b`:
the executable predicate found the package-install instruction and exited 1
because it lacked `--no-cache`. The repaired source makes the same predicate
pass. Hosted Trivy must independently confirm that `DS-0025` is absent on the
published exact head; other inherited Trivy findings are neither hidden nor
claimed repaired by this delta.

## Operational scene

An operator building the release image receives the same three runtime tools
without a persisted apk repository index. This reduces avoidable image content
without changing provider routing, filesystem authority, network policy, or
the runtime user. The separate non-root and immutable-base findings remain open.
