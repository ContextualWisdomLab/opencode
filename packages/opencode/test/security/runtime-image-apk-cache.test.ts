import { expect, test } from "bun:test"

function stripShellComment(command: string) {
  let quote: "'" | '"' | undefined
  let escaped = false

  for (let index = 0; index < command.length; index++) {
    const character = command[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (character === "\\" && quote !== "'") {
      escaped = true
      continue
    }
    if (quote) {
      if (character === quote) quote = undefined
      continue
    }
    if (character === "'" || character === '"') {
      quote = character
      continue
    }
    if (character === "#" && (index === 0 || /\s/.test(command[index - 1]))) {
      return command.slice(0, index).trim()
    }
  }

  return command.trim()
}

function apkInstallInstructions(dockerfile: string) {
  const installs: string[] = []
  let instruction = ""

  for (const rawLine of dockerfile.split("\n")) {
    const line = rawLine.trim()
    if (!instruction && (!line || line.startsWith("#"))) continue

    instruction += `${instruction ? " " : ""}${line.replace(/\\\s*$/, "").trim()}`
    if (line.endsWith("\\")) continue

    if (/^RUN(?:\s|$)/i.test(instruction)) {
      for (const command of instruction.slice(3).split(/&&|\|\||[;&|]/)) {
        const executableCommand = stripShellComment(command)
        if (/\bapk\s+add\b/.test(executableCommand)) installs.push(executableCommand)
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
  const commands = [
    apkInstallInstructions("RUN echo --no-cache && apk add curl")[0],
    apkInstallInstructions("RUN echo --no-cache & apk add curl")[0],
    apkInstallInstructions("RUN apk add curl # --no-cache")[0],
  ]

  expect(commands).toHaveLength(3)
  for (const command of commands) {
    expect(command.split(/\s+/)).not.toContain("--no-cache")
  }
})

test("package policy treats Docker instruction names case-insensitively", () => {
  expect(apkInstallInstructions("run apk add curl")).toEqual(["apk add curl"])
  expect(apkInstallInstructions(`RUN apk add "#literal" --no-cache`)).toEqual([
    `apk add "#literal" --no-cache`,
  ])
})

test("runtime image package installs disable the persistent apk index cache", async () => {
  const dockerfile = await Bun.file(new URL("../../Dockerfile", import.meta.url)).text()
  const apkInstalls = apkInstallInstructions(dockerfile)

  expect(apkInstalls.length).toBeGreaterThan(0)
  for (const install of apkInstalls) {
    expect(install.split(/\s+/)).toContain("--no-cache")
  }
})
