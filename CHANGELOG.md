# Changelog

## Unreleased

- Prevent the OpenCode Alpine runtime-image package install from retaining the
  downloaded apk index in an image layer; add an executable package-install
  policy regression covering case-insensitive direct, compound, backgrounded,
  indented, commented, redirected, and continued Docker instructions without
  treating quoted prose as execution. Exact-head hosted security evidence
  remains required.
