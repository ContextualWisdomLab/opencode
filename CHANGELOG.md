# Changelog

## Unreleased

- Prevent the OpenCode Alpine runtime-image package install from retaining the
  downloaded apk index in an image layer; add an executable package-install
  policy regression covering direct, compound, indented, and continued Docker
  instructions. Exact-head hosted security evidence remains required.
