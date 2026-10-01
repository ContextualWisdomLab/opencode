import { expect, test } from "bun:test"

test("runtime image package install disables the persistent apk index cache", async () => {
  const dockerfile = await Bun.file(new URL("../../Dockerfile", import.meta.url)).text()
  const apkInstallLines = dockerfile
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^RUN\s+apk\s+add(?:\s|$)/.test(line))

  expect(apkInstallLines).toEqual(["RUN apk add --no-cache libgcc libstdc++ ripgrep"])
})

test("runtime image pins its external base and drops root before startup", async () => {
  const dockerfile = await Bun.file(new URL("../../Dockerfile", import.meta.url)).text()
  const instructions = dockerfile
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  expect(instructions.filter((line) => line.startsWith("FROM "))).toEqual([
    "FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS base",
    "FROM scratch AS runtime-binaries",
    "FROM base AS runtime",
  ])
  expect(instructions.slice(-3)).toEqual([
    "USER opencode:opencode",
    "ENV HOME=/home/opencode",
    'ENTRYPOINT ["opencode"]',
  ])
})
