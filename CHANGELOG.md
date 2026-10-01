# Changelog

## Unreleased

- Give the complete shared build-container chain one fixed UID/GID 10001
  `build_agent` identity, elevate derived images only while provisioning, and
  restore the non-root identity with writable Bun and Cargo caches before each
  image is published. Retain hierarchy and Tauri final-stage regressions.
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
