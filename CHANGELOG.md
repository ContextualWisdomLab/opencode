# Changelog

## Unreleased

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
