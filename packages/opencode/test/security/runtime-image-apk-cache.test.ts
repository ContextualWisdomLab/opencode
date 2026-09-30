import { expect, test } from "bun:test"

test("runtime image package installs disable the persistent apk index cache", async () => {
  const dockerfile = await Bun.file(new URL("../../Dockerfile", import.meta.url)).text()
  const apkInstalls = dockerfile
    .split("\n")
    .filter((line) => line.startsWith("RUN apk add "))

  expect(apkInstalls.length).toBeGreaterThan(0)
  for (const install of apkInstalls) {
    expect(install.split(/\s+/)).toContain("--no-cache")
  }
})
