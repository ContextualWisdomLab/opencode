import { expect, test } from "bun:test"

function literalApkAddOccurrences(dockerfile: string) {
  const occurrences: string[] = []
  let instruction = ""

  for (const rawLine of dockerfile.split("\n")) {
    const line = rawLine.trim()
    if (!instruction && (!line || line.startsWith("#"))) continue

    instruction += `${instruction ? " " : ""}${line.replace(/\\\s*$/, "").trim()}`
    if (line.endsWith("\\")) continue

    if (/^RUN(?:\s|$)/i.test(instruction)) {
      for (const match of instruction.matchAll(/\bapk\s+add\b/g)) {
        occurrences.push(instruction.slice(match.index))
      }
    }
    instruction = ""
  }

  return occurrences
}

function immediatelyUsesNoCache(occurrence: string) {
  return /^apk\s+add\s+--no-cache(?:\s|$)/.test(occurrence)
}

test("package policy recognizes literal apk add across logical RUN forms", () => {
  const dockerfile = `
RUN apk add curl
RUN set -eux; apk add git
RUN echo ready & apk add wget
run > /tmp/apk.log apk add bash
  RUN apk update && \\
    apk add zsh
`

  expect(literalApkAddOccurrences(dockerfile)).toHaveLength(5)
})

test("package policy does not borrow no-cache from unrelated shell text", () => {
  const dockerfiles = [
    "RUN echo --no-cache && apk add curl",
    "RUN apk add curl # --no-cache",
    "RUN apk add curl > --no-cache",
    `RUN echo "safe; apk add curl"`,
    `RUN apk add '--no-cache' curl`,
  ]

  for (const dockerfile of dockerfiles) {
    const [occurrence] = literalApkAddOccurrences(dockerfile)
    expect(immediatelyUsesNoCache(occurrence)).toBe(false)
  }
})

test("runtime image package installs disable the persistent apk index cache", async () => {
  const dockerfile = await Bun.file(new URL("../../Dockerfile", import.meta.url)).text()
  const occurrences = literalApkAddOccurrences(dockerfile)

  expect(occurrences.length).toBeGreaterThan(0)
  for (const occurrence of occurrences) {
    expect(immediatelyUsesNoCache(occurrence)).toBe(true)
  }
})
