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

The first exact-head scan after that repair exposed two additional defects at
the same canonical runtime-image boundary. The image used untagged `alpine`,
selected a local build stage through mutable-looking `FROM build-${TARGETARCH}`
syntax, and never changed from root before its entrypoint. Security Scan run
`36771095591`, job `110077455374`, reported `DS-0001` and `DS-0002`; SAST run
`36771095492`, job `110077389186`, independently reported the missing final
user. These are integrated here rather than hidden or deferred behind a leaf
workaround.

Docker Hub's registry returned the multi-architecture manifest digest
`sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6`
for `alpine:3.24.2` on 2026-10-01 UTC. The repair pins both tag and digest,
copies the two release binaries into a scratch stage, selects the requested
`amd64` or `arm64` binary through an ephemeral BuildKit bind mount, and creates
the final `opencode` identity with fixed UID/GID 10001. The entrypoint runs as
that identity with `HOME=/home/opencode`; this avoids changing users while
leaving application state pointed at root's unwritable home.

RED was reproduced against protected `dev@b3f1a96c6dd7adeb28b36dd11add1998fc84d67b`:
the executable predicate found the package-install instruction and exited 1
because it lacked `--no-cache`. The repaired source makes the same predicate
pass. The hardening regression was also observed RED against exact head
`681b65a3c0d9a3af5569bd68caa46ed732e41050`: the base was unpinned, the final
stage was dynamically selected, and no final `USER` existed. Bun 1.3.14
executes both production-file regressions GREEN (2 tests, 3 assertions).
Hosted build, Trivy, and Semgrep must independently confirm the published
successor exact head; no inherited finding outside the OpenCode runtime image
is hidden or claimed repaired by this delta.

Independent review then proved the first hardening predicate was incomplete:
Docker instructions are case-insensitive, but it counted only uppercase
`FROM`, and it asserted the final `HOME` value without asserting that BusyBox
actually created that home. RED fixtures appended a lowercase mutable final
stage and separately changed `adduser -h /home/opencode` to `adduser -H`;
the predecessor predicate accepted both. The successor policy counts `FROM`
case-insensitively, pins the exact group/user/home creation instructions, and
retains both mutations as negative executable cases.

## Decision and alternatives

The selected design keeps one final runtime stage and one runtime package set.
It uses native Dockerfile primitives and preserves the existing `TARGETARCH`
contract. Scanner suppression and path allowlists were rejected because they
would make the gate vacuous. A tag without a digest was rejected because the
resolved bytes could change. Duplicated final images were rejected because
they would create two release configurations to keep synchronized. Copying
both binaries into the final filesystem and deleting one was rejected because
the unused binary would remain in an image layer.

The material compatibility risk is the BuildKit bind-mount requirement. The
repository already depends on BuildKit automatic `TARGETARCH`; the new mount
keeps the same build boundary and fails closed with exit 64 for unsupported
architectures. The fixed unprivileged identity can expose hidden write-to-root
assumptions, so the exact-head image build and runtime version probe remain
mandatory before this proposal can advance.

## Operational scene

An operator building the release image receives the same three runtime tools
without a persisted apk repository index, while the selected OpenCode binary
is installed without retaining the other architecture's binary. A compromised
OpenCode process starts as UID/GID 10001 rather than root, and rebuilds resolve
the reviewed Alpine manifest instead of a moving base. Provider routing and
network policy are unchanged. Shared container and inherited dependency
findings remain explicitly Open in the Gap baseline.
