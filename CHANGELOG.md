# Changelog

## Unreleased

- Prevent the OpenCode Alpine runtime-image package install from retaining the
  downloaded apk index in an image layer; add an executable package-install
  conservative logical-`RUN` regression requiring every literal `apk add` to
  use an immediate unquoted `--no-cache`. Ambiguous literal occurrences fail
  safe; unsupported Docker escape directives and RUN heredocs fail closed.
  Exact-head hosted security evidence remains required.
