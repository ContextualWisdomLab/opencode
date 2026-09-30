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

function apkInstallUsesNoCache(command: string) {
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
    if (character === "<" || character === ">") {
      return command.slice(0, index).split(/\s+/).includes("--no-cache")
    }
  }

  return command.split(/\s+/).includes("--no-cache")
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
        if (/^(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*apk\s+add(?:\s|$)/.test(executableCommand)) {
          installs.push(executableCommand)
        }
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
    expect(apkInstallUsesNoCache(command)).toBe(false)
  }
})

test("package policy treats Docker instruction names case-insensitively", () => {
  expect(apkInstallInstructions("run apk add curl")).toEqual(["apk add curl"])
  expect(apkInstallInstructions(`RUN apk add "#literal" --no-cache`)).toEqual([
    `apk add "#literal" --no-cache`,
  ])
})

test("package policy reads apk argv instead of prose or redirect targets", () => {
  expect(apkInstallInstructions(`RUN echo "apk add curl"`)).toEqual([])

  const [redirectedInstall] = apkInstallInstructions("RUN apk add curl > --no-cache")
  expect(apkInstallUsesNoCache(redirectedInstall)).toBe(false)
  expect(apkInstallUsesNoCache(`apk add "pkg>name" --no-cache`)).toBe(true)
})

test("runtime image package installs disable the persistent apk index cache", async () => {
  const dockerfile = await Bun.file(new URL("../../Dockerfile", import.meta.url)).text()
  const apkInstalls = apkInstallInstructions(dockerfile)

  expect(apkInstalls.length).toBeGreaterThan(0)
  for (const install of apkInstalls) {
    expect(apkInstallUsesNoCache(install)).toBe(true)
  }
})
