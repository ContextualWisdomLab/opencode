import { expect, test } from "bun:test"

function apkInstallInstructions(dockerfile: string) {
  const installs: string[] = []
  let instruction = ""

  for (const rawLine of dockerfile.split("\n")) {
    const line = rawLine.trim()
    if (!instruction && (!line || line.startsWith("#"))) continue

    instruction += `${instruction ? " " : ""}${line.replace(/\\\s*$/, "").trim()}`
    if (line.endsWith("\\")) continue

    if (/^RUN(?:\s|$)/.test(instruction)) {
      for (const command of instruction.slice(3).split(/&&|\|\||[;|]/)) {
        if (/\bapk\s+add\b/.test(command)) installs.push(command.trim())
      }
    }
    instruction = ""
  }

  return installs
}

test("package policy recognizes compound and continued apk installs", () => {
  const dockerfile = `
RUN apk add curl
RUN set -eux; apk add git
  RUN apk update && \\
    apk add wget
`

  expect(apkInstallInstructions(dockerfile)).toHaveLength(3)
})

test("package policy does not borrow no-cache from a neighboring command", () => {
  const [apkInstall] = apkInstallInstructions("RUN echo --no-cache && apk add curl")

  expect(apkInstall.split(/\s+/)).not.toContain("--no-cache")
})

test("runtime image package installs disable the persistent apk index cache", async () => {
  const dockerfile = await Bun.file(new URL("../../Dockerfile", import.meta.url)).text()
  const apkInstalls = apkInstallInstructions(dockerfile)

  expect(apkInstalls.length).toBeGreaterThan(0)
  for (const install of apkInstalls) {
    expect(install.split(/\s+/)).toContain("--no-cache")
  }
})
