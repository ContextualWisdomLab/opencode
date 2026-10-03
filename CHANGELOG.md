# Changelog

## Unreleased

- Remove repository-owned direct model execution from GitHub Actions and the
  release call graph; release notes now use GitHub's platform generator while
  the central ContextualWisdomLab orchestration contract remains the sole model
  owner. The executable contract also rejects direct OpenCode commands hidden
  behind assignments, command wrappers, nested shell strings, quoting, or
  executable paths. The contract also recognizes the real CLI's `--print-logs`,
  `--log-level`, and `--pure` global options before `run`, using one conservative
  fail-closed deny-pattern instead of enumerating shell wrapper names. Shell
  line continuations cannot split the executable, option value, or `run` token
  away from that inspection.
- Refresh the GLM 5.2 video artifact lock within its existing Remotion ranges,
  removing five scanner-confirmed vulnerable transitive versions and retaining
  a fail-closed dependency-floor regression for the committed lockfile.
- Upgrade both directly shipped GitHub Action runtimes to `@actions/core`
  3.0.1 and `@actions/github` 9.1.1, remove their vulnerable Undici 5
  dependency paths, and derive the GitHub context type from the public API.
  Retain a lockfile regression for both publication boundaries.
- Give the complete shared build-container chain one fixed UID/GID 10001
  `build_agent` identity, elevate derived images only while provisioning, and
  restore the non-root identity with writable Bun and Cargo caches before each
  image is published. Build pull-request heads without GHCR login or push,
  withhold package-write permission from those builds, cancel stale revisions,
  and retain hierarchy, workflow, and Tauri regressions.
- Run the stats server image as a dedicated fixed UID/GID 10001 identity with
  an explicit writable home, and retain a production-Dockerfile regression
  that prevents a later root final stage.
- Pin the published OpenCode composite action's `actions/cache` dependency to
  the reviewed v4.3.0 commit and retain an executable immutable-reference
  regression.
- Prevent the OpenCode Alpine runtime-image package install from retaining the
  downloaded apk index in an image layer; add an executable regression that
  pins the canonical runtime package-install instruction, including its exact
  package set and apk's `--no-cache` option.
- Pin the OpenCode runtime base to the verified Alpine 3.24.2 manifest digest,
  replace the mutable architecture-selected `FROM` with a BuildKit-mounted
  binary stage, and run the final image as the dedicated unprivileged
  `opencode` identity with its writable home. The regression also rejects
  case-varied extra final stages and account creation that suppresses the home.
  Exact-head hosted security evidence remains required.
