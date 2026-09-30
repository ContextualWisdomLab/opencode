# Changelog

## Unreleased

- Prevent the OpenCode Alpine runtime-image package install from retaining the
  downloaded apk index in an image layer; add an executable regression that
  pins the canonical runtime package-install instruction, including its exact
  package set and apk's `--no-cache` option.
  Exact-head hosted security evidence remains required.
