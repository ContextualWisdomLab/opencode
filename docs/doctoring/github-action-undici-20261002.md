# GitHub Action Undici dependency repair

## Problem and evidence

OpenCode ships two GitHub Action runtimes: the standalone `github` package and
the `packages/opencode` CLI handler. Exact-head Security Scan run
`36848110099`, job `110323068088`, reported ten CVEs against
`undici@5.29.0` in `github/bun.lock`.

Dependency tracing showed two independent causes. `@actions/github@6.0.1`
depended on Undici 5 directly, while `@actions/core@1.11.1` reached the same
version through `@actions/http-client@2.2.3`. Updating only
`@actions/github` left the second path intact. The expanded lockfile regression
was RED on that remaining `@actions/core` path before the source repair.

## Constraints and decision

Both publication boundaries must use the same reviewed direct dependencies,
and unrelated development-only dependency trees are outside this repair. The
selected change upgrades the direct inputs to `@actions/core` 3.0.1 and
`@actions/github` 9.1.1 and regenerates both canonical Bun lockfiles.

The new `@actions/github` package exports no private `lib/context` subpath, so
both runtimes now derive `GitHubContext` from the public
`typeof github.context` value. Copying a private type or pinning an export
bypass was rejected because either would recreate an unsupported package
boundary. Overrides were rejected because upgrading the owning direct
dependencies removes the vulnerable paths without masking their provenance.

## Executable contract and effects

The focused Bun regression inspects the standalone and workspace lockfiles. It
rejects Undici 5 only on the directly shipped `@actions/core`,
`@actions/http-client`, and `@actions/github` paths, leaving independently
owned development tooling visible for separate repairs. After regeneration,
the direct paths resolve through `@actions/http-client` 3/4 and Undici 6.

The focused suite passes four tests with five assertions. A standalone
TypeScript check no longer reports the removed private context import; it
continues to expose four pre-existing package-boundary errors (the undeclared
`@octokit/webhooks-types`, missing `isScheduleEvent`, older SDK `agent` shape,
and its resulting implicit `any`) that are not hidden by this change.

## Risks and follow-up

Major Action toolkit upgrades require hosted build and behavior evidence at
the exact pull-request head. A clean local full-workspace install is also
blocked in this executor by the existing native `tree-sitter-powershell`
node-gyp header extraction failure, so that environmental limitation is not
treated as a passing product check. Fresh exact-head test, Security Scan, and
SAST receipts remain required before merge. The GLM 5.2 video artifact and
development-only Action trees remain separate open Gap entries.
