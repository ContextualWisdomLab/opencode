import { expect, test } from "bun:test"

const runtimeImageFromInstructions = [
  "FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS base",
  "FROM scratch AS runtime-binaries",
  "FROM base AS runtime",
]

function followsRuntimeImageHardeningPolicy(dockerfile: string) {
  const instructions = dockerfile
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    JSON.stringify(instructions.filter((line) => /^FROM\s/i.test(line))) ===
      JSON.stringify(runtimeImageFromInstructions) &&
    JSON.stringify(instructions.filter((line) => /^(?:RUN addgroup|&& adduser)/.test(line))) ===
      JSON.stringify([
        "RUN addgroup -S -g 10001 opencode \\",
        "&& adduser -S -D -u 10001 -G opencode -h /home/opencode opencode",
      ]) &&
    JSON.stringify(instructions.slice(-3)) ===
      JSON.stringify(["USER opencode:opencode", "ENV HOME=/home/opencode", 'ENTRYPOINT ["opencode"]'])
  )
}

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

  expect(followsRuntimeImageHardeningPolicy(dockerfile)).toBe(true)
})

test("runtime image hardening rejects lowercase final stages and missing homes", async () => {
  const dockerfile = await Bun.file(new URL("../../Dockerfile", import.meta.url)).text()
  const lowercaseFinalStage = `${dockerfile}\nfrom alpine AS bypass\nUSER opencode:opencode\nENV HOME=/home/opencode\nENTRYPOINT ["opencode"]\n`
  const missingHome = dockerfile.replace("adduser -S -D -u 10001", "adduser -S -D -H -u 10001")

  expect(followsRuntimeImageHardeningPolicy(lowercaseFinalStage)).toBe(false)
  expect(followsRuntimeImageHardeningPolicy(missingHome)).toBe(false)
})
