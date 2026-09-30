import { expect, test } from "bun:test"

test("runtime image package install disables the persistent apk index cache", async () => {
  const dockerfile = await Bun.file(new URL("../../Dockerfile", import.meta.url)).text()
  const apkInstallLines = dockerfile
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^RUN\s+apk\s+add(?:\s|$)/.test(line))

  expect(apkInstallLines).toEqual(["RUN apk add --no-cache libgcc libstdc++ ripgrep"])
})
