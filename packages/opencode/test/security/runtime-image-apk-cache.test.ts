import { expect, test } from "bun:test"

function literalApkAddOccurrences(dockerfile: string) {
  const occurrences: string[] = []
  let parserDirectivesAllowed = true

  for (const rawLine of dockerfile.split("\n")) {
    const line = rawLine.trim()
    if (parserDirectivesAllowed && /^#\s*(?:syntax|escape|check)\s*=/i.test(line)) {
      if (/^#\s*escape\s*=/i.test(line) && !/^#\s*escape\s*=\s*\\\s*$/i.test(line)) {
        occurrences.push("unsupported Docker escape directive")
      }
      continue
    }
    parserDirectivesAllowed = false
    if (!line || line.startsWith("#")) continue

    const trailingBackslashes = line.match(/\\+$/)?.[0].length ?? 0
    if (trailingBackslashes % 2 === 1) {
      occurrences.push("unsupported Docker line continuation")
    }
    if (!/^RUN(?:\s|$)/i.test(line)) continue

    let quote = ""
    let arithmeticDepth = 0
    let code = ""
    for (let index = 0; index < line.length; index++) {
      const character = line[index]
      if (quote) {
        code += " "
        if (character === quote) quote = ""
        else if (quote === '"' && character === "\\") {
          code += " "
          index++
        }
        continue
      }
      if (character === '"' || character === "'") {
        quote = character
        code += " "
      } else if (character === "#" && (index === 0 || /\s/.test(line[index - 1]))) {
        code += " ".repeat(line.length - index)
        break
      } else if (line.slice(index, index + 3) === "$((") {
        code += "$(("
        arithmeticDepth++
        index += 2
      } else if (arithmeticDepth && line.slice(index, index + 2) === "))") {
        code += "))"
        arithmeticDepth--
        index++
      } else if (character === "\\") {
        code += "  "
        index++
      } else if (!arithmeticDepth && character === "<" && line[index + 1] === "<") {
        occurrences.push("unsupported RUN heredoc")
        break
      } else code += character
    }

    for (const match of code.matchAll(/\bapk\s+add\b/g)) {
      occurrences.push(line.slice(match.index))
    }
    const literalCount = [...line.matchAll(/\bapk\s+add\b/g)].length
    const executableCount = [...code.matchAll(/\bapk\s+add\b/g)].length
    for (let count = executableCount; count < literalCount; count++) {
      occurrences.push("ambiguous literal apk add")
    }
  }

  return occurrences
}

function immediatelyUsesNoCache(occurrence: string) {
  return /^apk\s+add\s+--no-cache(?:\s|$)/.test(occurrence)
}

test("package policy recognizes literal apk add across shell-form RUN instructions", () => {
  const dockerfile = `
RUN apk add curl
RUN set -eux; apk add git
RUN echo ready & apk add wget
run > /tmp/apk.log apk add bash
`

  expect(literalApkAddOccurrences(dockerfile)).toHaveLength(4)
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

test("package policy fails closed on unsupported Docker instruction forms", () => {
  const dockerfiles = [
    "RUN <<EOF\napk add curl\nEOF",
    "RUN <<'EOF'\napk add curl\nEOF",
    'RUN <<"EOF"\napk add curl\nEOF',
    "# escape=`\nRUN echo ready && `\napk add curl",
    "RUN apk add --no-cache curl\nRUN ap\\\nk add bash",
    "RUN apk add --no-cache curl\nRUN sh <\\\n<EOF\napk add bash\nEOF",
    "RUN apk add --no-cache curl\nRUN echo ready && \\\napk add bash \\",
  ]

  for (const dockerfile of dockerfiles) {
    const policySubjects = literalApkAddOccurrences(dockerfile)
    expect(policySubjects.length).toBeGreaterThan(0)
    expect(policySubjects.every(immediatelyUsesNoCache)).toBe(false)
  }
})

test("package policy does not swallow an instruction after escaped backslashes", () => {
  const dockerfile = "RUN apk add --no-cache curl\nLABEL note=foo\\\\\nRUN apk add bash"
  const policySubjects = literalApkAddOccurrences(dockerfile)

  expect(policySubjects).toHaveLength(2)
  expect(policySubjects.every(immediatelyUsesNoCache)).toBe(false)
})

test("package policy ignores heredoc-like quoted data and late directive comments", () => {
  const dockerfile = [
    "RUN apk add --no-cache curl",
    'RUN printf "%s\\\\n" "a << b"',
    "# escape=`",
    "RUN echo ok",
  ].join("\n")

  const policySubjects = literalApkAddOccurrences(dockerfile)
  expect(policySubjects).toHaveLength(1)
  expect(policySubjects.every(immediatelyUsesNoCache)).toBe(true)
})

test("package policy rejects quoted or commented apk add literals", () => {
  const dockerfiles = [
    'RUN echo "apk add --no-cache curl"',
    "RUN echo ok # apk add --no-cache curl",
  ]

  for (const dockerfile of dockerfiles) {
    const policySubjects = literalApkAddOccurrences(dockerfile)
    expect(policySubjects.length).toBeGreaterThan(0)
    expect(policySubjects.every(immediatelyUsesNoCache)).toBe(false)
  }
})

test("ordinary comments and blank lines close the parser-directive preamble", () => {
  const dockerfiles = [
    "# ordinary comment\n# escape=`\nRUN apk add --no-cache curl",
    "\n# escape=`\nRUN apk add --no-cache curl",
  ]

  for (const dockerfile of dockerfiles) {
    const policySubjects = literalApkAddOccurrences(dockerfile)
    expect(policySubjects).toHaveLength(1)
    expect(policySubjects.every(immediatelyUsesNoCache)).toBe(true)
  }
})

test("package policy does not confuse arithmetic shifts with heredocs", () => {
  const dockerfile = "RUN apk add --no-cache curl\nRUN echo $((1 << 2))"
  const policySubjects = literalApkAddOccurrences(dockerfile)

  expect(policySubjects).toHaveLength(1)
  expect(policySubjects.every(immediatelyUsesNoCache)).toBe(true)
})

test("runtime image package installs disable the persistent apk index cache", async () => {
  const dockerfile = await Bun.file(new URL("../../Dockerfile", import.meta.url)).text()
  const occurrences = literalApkAddOccurrences(dockerfile)

  expect(occurrences.length).toBeGreaterThan(0)
  for (const occurrence of occurrences) {
    expect(immediatelyUsesNoCache(occurrence)).toBe(true)
  }
})
