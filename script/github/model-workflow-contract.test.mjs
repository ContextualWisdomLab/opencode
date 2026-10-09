import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync } from "node:fs"
import path from "node:path"

const repositoryRoot = path.resolve(import.meta.dir, "../..")
const workflowDirectory = path.join(repositoryRoot, ".github/workflows")
const localActionDirectory = path.join(repositoryRoot, ".github/actions")
const yamlFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return yamlFiles(target)
    return entry.name.endsWith(".yml") || entry.name.endsWith(".yaml") ? [target] : []
  })
const expectedAutomationDigests = {
  ".github/actions/setup-bun/action.yml": "6b71d16d4de33f94cec0903a67133b4baa9ccf514d8b887d23a13bff47a7e7c7",
  ".github/actions/setup-git-committer/action.yml": "565ea588dee8c360e2d090e53390ef001573c87dd76cd63477e534c71d73a0b3",
  ".github/workflows/close-issues.yml": "0b39fb4743c4113a84c64e9dc8fc0ff8c84f76618959b3e645c91b2c024f5966",
  ".github/workflows/close-prs.yml": "515def738b7612418fc1acb6fae24be030d1b399f682bc1816e4c920ac73039e",
  ".github/workflows/compliance-close.yml": "3b0674e48cd1c431c07f6e2b1109423855d1687898ab878033efaea21649692f",
  ".github/workflows/containers.yml": "9504d675f66c9446b42cfc4b726e6b142413ce74191c0376d8edfb1f18df75be",
  ".github/workflows/deploy.yml": "97efdf0afdb6e281bbb79280ebf05907eb54c92c7dc213b63abd0c871ed6e325",
  ".github/workflows/generate.yml": "b29863a7844b6f6dd8a4978f08c8b1f1502040fc065506d5c4075bf6d171d96e",
  ".github/workflows/nix-eval.yml": "0aa73dab3aa88e07c0d5e40ba7e866a70dd4f747ef5d131ace2a1e3376c579fe",
  ".github/workflows/nix-hashes.yml": "5db008af1f407e814328787b2bcd572a164677d1eae335e45179908321292451",
  ".github/workflows/notify-discord.yml": "2b0752730942ab40d72adf679101c11d85e0c0947f7122764c510018137b8498",
  ".github/workflows/pr-management.yml": "3d2ed69f92bbcafdc5ef8759ffbe233cdce5b2112a81a13be6bb05ccda655ab7",
  ".github/workflows/pr-standards.yml": "47dc60af5b7ec0fce3d70212582c652c73ced3a6c28034486b77d13fc6f994be",
  ".github/workflows/publish-github-action.yml": "90a0feebe8f1a654da97533c74f42a8391fb9b9ef5642af017bf0e1ec488c50f",
  ".github/workflows/publish-vscode.yml": "a04913d9c15ee30a95da8f621068926f793672b5c7de9c0666df1086e7040a51",
  ".github/workflows/publish.yml": "daa8fd0e7aa5c1ab7eb42ce923b8fcb11fea4740cf3eeaa252a4c14c714d5383",
  ".github/workflows/release-github-action.yml": "eb8ed10cc42b979b5cb9c840c3b5fafdc539fb8efe1de895828fd045271ad213",
  ".github/workflows/stats.yml": "e4fa8b96c0c227eb14a0890b655c8929cba5f2c06c36c0d4c6ebe2b45fef2632",
  ".github/workflows/storybook.yml": "42276e366efaf2b52c62a8f4626235daba2a74ac3449fdd9ee9ce7a208767a1e",
  ".github/workflows/test.yml": "74afa29de563d94f787517a10f3b84a733d0f74f1e3b6301e4f688fbf175db86",
  ".github/workflows/typecheck.yml": "fbc083541886896bc6d7b4d23cd96144e7ef7635dd394820ab4bda4c98ed55c7",
  ".github/workflows/unlock.yml": "5da51708a3edc2e7b8e2e005351bab86063e162413e3aab919fad3f133f2ca16",
}
const expectedVersionScript = `#!/usr/bin/env bun

import { Script } from "@opencode-ai/script"
import { $ } from "bun"

const output = [\`version=\${Script.version}\`]
const sha = process.env.GITHUB_SHA ?? (await $\`git rev-parse HEAD\`.text()).trim()

if (!Script.preview) {
  await $\`gh release create v\${Script.version} -d --target \${sha} --title \"v\${Script.version}\" --generate-notes\`
  const release = await $\`gh release view v\${Script.version} --json tagName,databaseId\`.json()
  output.push(\`release=\${release.databaseId}\`)
  output.push(\`tag=\${release.tagName}\`)
} else if (Script.channel === "beta") {
  await $\`gh release create v\${Script.version} -d --title \"v\${Script.version}\" --repo \${process.env.GH_REPO}\`
  const release =
    await $\`gh release view v\${Script.version} --json tagName,databaseId --repo \${process.env.GH_REPO}\`.json()
  output.push(\`release=\${release.databaseId}\`)
  output.push(\`tag=\${release.tagName}\`)
}

output.push(\`repo=\${process.env.GH_REPO}\`)

if (process.env.GITHUB_OUTPUT) {
  await Bun.write(process.env.GITHUB_OUTPUT, output.join("\\n"))
}

process.exit(0)
`

describe("repository model-workflow ownership", () => {
  test("keeps PR management limited to contributor labeling", async () => {
    const workflow = Bun.YAML.parse(await Bun.file(path.join(workflowDirectory, "pr-management.yml")).text())

    expect(workflow.on).toEqual({ pull_request_target: { types: ["opened"] } })
    expect(workflow.jobs).toEqual({
      "add-contributor-label": {
        "runs-on": "ubuntu-latest",
        permissions: {
          "pull-requests": "write",
          issues: "write",
        },
        steps: [
          {
            name: "Add Contributor Label",
            uses: "actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd",
            with: {
              script: `const isPR = !!context.payload.pull_request;
const issueNumber = isPR ? context.payload.pull_request.number : context.payload.issue.number;
const authorAssociation = isPR ? context.payload.pull_request.author_association : context.payload.issue.author_association;

if (authorAssociation === 'CONTRIBUTOR') {
  await github.rest.issues.addLabels({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    labels: ['contributor']
  });
}
`,
            },
          },
        ],
      },
    })
  })

  test("contains no repository-owned direct model execution", async () => {
    const retiredWorkflows = [
      "docs-locale-sync.yml",
      "docs-update.yml",
      "duplicate-issues.yml",
      "opencode.yml",
      "review.yml",
      "triage.yml",
    ]
    const providerCredentials = [
      "OPENCODE_API_KEY",
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "OPENROUTER_API_KEY",
      "BYTEZ_API_KEY",
      "NVIDIA_NIM_API_KEY",
      "NVIDIA_NIM_API_KEY_SUB",
    ]
    const modelActionPrefixes = ["anomalyco/opencode/github@", "sst/opencode/github@"]
    const modelAutomationEntrypoints = [
      "script/beta.ts",
      "script/changelog.ts",
      "script/duplicate-pr.ts",
      "script/translate-app.ts",
    ]
    const violations = []
    const workflowNames = readdirSync(workflowDirectory)
      .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
      .sort()
    const automationFiles = [
      ...workflowNames.map((name) => path.join(workflowDirectory, name)),
      ...yamlFiles(localActionDirectory),
    ]
    const heredocDeclarations = (line) => {
      const declarations = []
      let quote = ""
      let tokenStarted = false
      for (let index = 0; index < line.length; index++) {
        const character = line[index]
        if (quote) {
          if (character === quote) quote = ""
          else if (character === "\\" && quote === '"') index++
          continue
        }
        if (character === "\\") {
          tokenStarted = true
          index++
          continue
        }
        if (character === "'" || character === '"') {
          quote = character
          tokenStarted = true
          continue
        }
        if (character === "#" && !tokenStarted) break
        if (/\s/.test(character) || ";&|(){}".includes(character)) {
          tokenStarted = false
          continue
        }
        if (character !== "<" || line[index + 1] !== "<" || line[index + 2] === "<") {
          tokenStarted = true
          continue
        }
        let cursor = index + 2
        const stripTabs = line[cursor] === "-"
        if (stripTabs) cursor++
        while (/\s/.test(line[cursor] ?? "")) cursor++
        let value = ""
        let delimiterQuote = ""
        let quoted = false
        while (cursor < line.length) {
          if (delimiterQuote) {
            if (line[cursor] === delimiterQuote) delimiterQuote = ""
            else value += line[cursor]
            cursor++
            continue
          }
          if (line[cursor] === "'" || line[cursor] === '"') {
            quoted = true
            delimiterQuote = line[cursor++]
            continue
          }
          if (line[cursor] === "\\") {
            quoted = true
            value += line[++cursor] ?? ""
            cursor++
            continue
          }
          if (/[\s;&|(){}]/.test(line[cursor])) break
          value += line[cursor++]
        }
        if (value) declarations.push({ expand: !quoted, stripTabs, value })
        index = cursor
        tokenStarted = true
      }
      return declarations
    }
    const withoutHeredocBodies = (source) => {
      const kept = []
      const subcommands = []
      const pending = []
      for (const line of source.split("\n")) {
        if (pending.length) {
          const delimiter = pending[0]
          if ((delimiter.stripTabs ? line.replace(/^\t+/, "") : line) === delimiter.value) pending.shift()
          else if (delimiter.expand) subcommands.push(...shellSubcommands(line))
          continue
        }
        kept.push(line)
        pending.push(...heredocDeclarations(line))
      }
      return { source: kept.join("\n"), subcommands }
    }
    const shellCommands = (source) => {
      const commands = []
      let command = []
      let token = ""
      let dynamic = false
      let started = false
      let quote = ""
      const finishToken = () => {
        if (!started) return
        command.push({ value: token, dynamic })
        token = ""
        dynamic = false
        started = false
      }
      const finishCommand = () => {
        finishToken()
        if (command.length) commands.push(command)
        command = []
      }
      for (let index = 0; index < source.length; index++) {
        const character = source[index]
        if (quote) {
          if (character === quote) {
            quote = ""
            continue
          }
          if (character === "\\" && quote === '"' && /[$`"\\]/.test(source[index + 1] ?? "")) {
            token += source[++index]
            continue
          }
          if (quote === '"' && (character === "$" || character === "`")) dynamic = true
          token += character
          continue
        }
        if (character === "'" || character === '"') {
          started = true
          quote = character
          continue
        }
        if (character === "\\") {
          started = true
          token += source[++index] ?? ""
          continue
        }
        if (character === "$" && source[index + 1] === "{") {
          const end = source.indexOf("}", index + 2)
          started = true
          dynamic = true
          token += source.slice(index, end < 0 ? source.length : end + 1)
          index = end < 0 ? source.length : end
          continue
        }
        if (character === "$" || character === "`") {
          started = true
          dynamic = true
          token += character
          continue
        }
        if (character === "#" && !started) {
          finishCommand()
          while (index + 1 < source.length && source[index + 1] !== "\n") index++
          continue
        }
        if (/\s/.test(character)) {
          finishToken()
          if (character === "\n") finishCommand()
          continue
        }
        if (character === "&" && source[index + 1] === ">") {
          started = true
          token += "&>"
          index++
          continue
        }
        if (character === "&" && /^\d*(?:>>?|<<?)$/.test(token)) {
          token += "&"
          continue
        }
        if (";&|(){}".includes(character)) {
          finishCommand()
          if ((character === "&" || character === "|") && source[index + 1] === character) index++
          continue
        }
        started = true
        token += character
      }
      finishCommand()
      return commands
    }
    const shellSubcommands = (source) => {
      const subcommands = []
      let quote = ""
      let tokenStarted = false
      for (let index = 0; index < source.length; index++) {
        const character = source[index]
        if (quote === "'") {
          if (character === "'") quote = ""
          continue
        }
        if (quote === '"' && character === '"') {
          quote = ""
          continue
        }
        if (character === "\\") {
          tokenStarted = true
          index++
          continue
        }
        if (!quote && character === "'") {
          tokenStarted = true
          quote = "'"
          continue
        }
        if (!quote && character === '"') {
          tokenStarted = true
          quote = '"'
          continue
        }
        if (!quote && character === "#" && !tokenStarted) {
          while (index + 1 < source.length && source[index + 1] !== "\n") index++
          continue
        }
        if (!quote && (/\s/.test(character) || ";&|(){}".includes(character))) {
          tokenStarted = false
          continue
        }
        if (character === "`") {
          tokenStarted = true
          let end = index + 1
          while (end < source.length && source[end] !== "`") {
            if (source[end] === "\\") end++
            end++
          }
          subcommands.push(source.slice(index + 1, end))
          index = end
          continue
        }
        if (character !== "$" || source[index + 1] !== "(" || source[index + 2] === "(") {
          tokenStarted = true
          continue
        }
        tokenStarted = true
        let depth = 1
        let nestedQuote = ""
        let end = index + 2
        for (; end < source.length && depth; end++) {
          const nested = source[end]
          if (nestedQuote) {
            if (nested === "\\" && nestedQuote === '"') end++
            else if (nested === nestedQuote) nestedQuote = ""
            continue
          }
          if (nested === "\\") {
            end++
            continue
          }
          if (nested === "'" || nested === '"' || nested === "`") {
            nestedQuote = nested
            continue
          }
          if (nested === "(") depth++
          else if (nested === ")") depth--
        }
        if (!depth) subcommands.push(source.slice(index + 2, end - 1))
        index = end - 1
      }
      return subcommands
    }
    const executableName = (value) => value.split(/[\/\\]/).at(-1)?.toLowerCase()
    const isAssignment = (token) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(token.value)
    const withoutRedirections = (command) => {
      const words = []
      for (let index = 0; index < command.length; index++) {
        const redirection = command[index].value.match(/^(?:\d*(?:>>?|<<?|<>|>&|<&)|&>>?)(.*)$/)
        if (!redirection) {
          words.push(command[index])
          continue
        }
        if (!redirection[1]) index++
      }
      return words
    }
    const commandStart = (command) => {
      let index = 0
      while (command[index]) {
        if (
          isAssignment(command[index]) ||
          ["!", "elif", "else", "if", "then", "until", "while", "do"].includes(command[index].value)
        ) {
          index++
          continue
        }
        break
      }
      return index
    }
    const isVariableReference = (token) =>
      /^\$(?:[A-Za-z_][A-Za-z0-9_]*|env:[A-Za-z_][A-Za-z0-9_]*|\{(?:[A-Za-z_][A-Za-z0-9_]*|env:[A-Za-z_][A-Za-z0-9_]*)\})$/i.test(
        token.value,
      )
    const isDynamicVariable = (token) => Boolean(token?.dynamic) && isVariableReference(token)
    const hasOpenCodeRunArguments = (command, start) => {
      let index = start
      while (command[index]) {
        const option = command[index]
        if (option.dynamic) return false
        if (option.value === "run") return true
        if (["--no-print-logs", "--no-pure", "--print-logs", "--pure"].includes(option.value)) {
          index++
          continue
        }
        if (/^--(?:print-logs|pure)=(?:true|false)$/i.test(option.value)) {
          index++
          continue
        }
        if (/^--log-level=(?:DEBUG|INFO|WARN|ERROR)$/i.test(option.value)) {
          index++
          continue
        }
        if (option.value === "--log-level" && /^(?:DEBUG|INFO|WARN|ERROR)$/i.test(command[index + 1]?.value ?? "")) {
          index += 2
          continue
        }
        return false
      }
      return false
    }
    const splitEnvWords = (source) => {
      const words = []
      let value = ""
      let dynamic = false
      let started = false
      let quote = ""
      const finish = () => {
        if (!started) return
        words.push({ value, dynamic })
        value = ""
        dynamic = false
        started = false
      }
      for (let index = 0; index < source.length; index++) {
        const character = source[index]
        if (quote) {
          if (character === quote) quote = ""
          else if (character === "\\" && quote === "'") value += character
          else if (character === "\\") {
            const escaped = source[++index]
            if (escaped === "_") value += " "
            else if (escaped === "c") break
            else if (escaped === "f") value += "\f"
            else if (escaped === "n") value += "\n"
            else if (escaped === "r") value += "\r"
            else if (escaped === "t") value += "\t"
            else if (escaped === "v") value += "\v"
            else if (["\\", '"', "'", "#", "$"].includes(escaped)) value += escaped
            else return { unsupported: true, words }
          }
          else {
            if (character === "$" || character === "`") dynamic = true
            value += character
          }
          started = true
          continue
        }
        if (character === "'" || character === '"') {
          quote = character
          started = true
          continue
        }
        if (character === "\\") {
          const escaped = source[++index]
          if (escaped === "_") finish()
          else if (escaped === "c") break
          else if (escaped === "f") value += "\f"
          else if (escaped === "n") value += "\n"
          else if (escaped === "r") value += "\r"
          else if (escaped === "t") value += "\t"
          else if (escaped === "v") value += "\v"
          else if (["\\", '"', "'", "#", "$"].includes(escaped)) value += escaped
          else return { unsupported: true, words }
          started ||= escaped !== "_"
          continue
        }
        if (character === "#" && !started) break
        if (/\s/.test(character)) {
          finish()
          continue
        }
        if (character === "$" || character === "`") dynamic = true
        value += character
        started = true
      }
      if (quote) return { unsupported: true, words }
      finish()
      return { unsupported: false, words }
    }
    const unwrapCommand = (initialCommand) => {
      let command = initialCommand
      let index = commandStart(command)
      const sourceWidth = initialCommand.reduce((total, token) => total + token.value.length + 1, 0)
      for (let remaining = sourceWidth + 1; remaining > 0; remaining--) {
        const executable = command[index]
        const name = executableName(executable?.value ?? "")
        if (!executable || executable.dynamic) return { command, executable, index, name }
        if (name === "env") {
          index++
          let replaced = false
          while (command[index]) {
            const option = command[index]
            if (isAssignment(option)) {
              index++
              continue
            }
            if (option.value === "--") {
              index++
              break
            }
            if (["-S", "--split-string"].includes(option.value)) {
              const operand = command[index + 1]
              if (!operand || operand.dynamic) return { command, dynamicScript: true, index, name }
              const split = splitEnvWords(operand.value)
              if (split.unsupported) return { command, dynamicScript: true, index, name }
              command = [
                { value: "env", dynamic: false },
                ...split.words,
                ...command.slice(index + 2),
              ]
              index = 0
              replaced = true
              break
            }
            if (option.value.startsWith("--split-string=")) {
              if (option.dynamic) return { command, dynamicScript: true, index, name }
              const split = splitEnvWords(option.value.slice("--split-string=".length))
              if (split.unsupported) return { command, dynamicScript: true, index, name }
              command = [
                { value: "env", dynamic: false },
                ...split.words,
                ...command.slice(index + 1),
              ]
              index = 0
              replaced = true
              break
            }
            if (["-C", "--chdir", "-u", "--unset"].includes(option.value)) {
              index += 2
              continue
            }
            if (/^-[^-]*S/.test(option.value)) {
              return { command, dynamicScript: true, index, name }
            }
            if (option.value.startsWith("-") && option.value !== "-") {
              index++
              continue
            }
            break
          }
          if (replaced) continue
          continue
        }
        if (name === "command") {
          index++
          while (command[index]?.value.startsWith("-")) {
            const option = command[index++].value
            if (option === "--") break
            if (/^-[^-]*[vV]/.test(option)) return { command, index, name, query: true }
          }
          continue
        }
        if (name === "exec") {
          index++
          while (command[index]?.value.startsWith("-")) {
            const option = command[index++].value
            if (option === "--") break
            if (option === "-a") index++
          }
          continue
        }
        if (name === "time") {
          index++
          while (command[index]?.value.startsWith("-")) {
            const option = command[index++].value
            if (["-f", "--format", "-o", "--output"].includes(option)) index++
          }
          continue
        }
        return { command, executable, index, name }
      }
      return { command, dynamicScript: true, index, name: "" }
    }
    const commandScript = ({ command, index, name }) => {
      if (name === "eval") {
        const tokens = command.slice(index + 1)
        return { source: tokens.map((token) => token.value).join(" "), tokens }
      }
      if (!["bash", "dash", "sh", "zsh", "powershell", "pwsh"].includes(name)) return undefined
      index++
      while (command[index]) {
        const option = command[index].value
        const acceptsScript =
          ["powershell", "pwsh"].includes(name)
            ? option.toLowerCase() === "-command"
            : /^-[a-z]*c[a-z]*$/i.test(option)
        if (acceptsScript) {
          const tokens = ["powershell", "pwsh"].includes(name)
            ? command.slice(index + 1)
            : command.slice(index + 1, index + 2)
          return { source: tokens.map((token) => token.value).join(" "), tokens }
        }
        index++
      }
      return undefined
    }
    const commandRunsOpenCode = (initialCommand) => {
      const resolved = unwrapCommand(initialCommand)
      const { command, executable, index, name } = resolved
      if (resolved.invalid || resolved.query || resolved.dynamicScript || !executable || executable.dynamic) return false
      if (name === "eval") {
        const script = commandScript(resolved)
        if (script.tokens.some((token) => token.dynamic)) return false
        return containsDirectOpenCodeCommand(script.source)
      }
      if (["bash", "dash", "sh", "zsh", "powershell", "pwsh"].includes(name)) {
        const script = commandScript(resolved)
        if (!script || script.tokens.some((token) => token.dynamic)) return false
        return containsDirectOpenCodeCommand(script.source)
      }
      if (name !== "opencode" && name !== "opencode.exe") return false
      return hasOpenCodeRunArguments(command, index + 1)
    }
    const commandUsesDynamicExecutable = (initialCommand) => {
      const resolved = unwrapCommand(initialCommand)
      const { command, executable, index } = resolved
      if (resolved.invalid || resolved.query || resolved.dynamicScript || !executable) return false
      if (isDynamicVariable(executable)) return hasOpenCodeRunArguments(command, index + 1)
      const script = commandScript(resolved)
      if (!script || script.tokens.some((token) => token.dynamic)) return false
      return containsUnsupportedDynamicExecutable(script.source)
    }
    const commandUsesDynamicScript = (initialCommand) => {
      const resolved = unwrapCommand(initialCommand)
      if (resolved.invalid || resolved.query) return false
      if (resolved.dynamicScript) return true
      const script = commandScript(resolved)
      if (!script) return false
      if (script.tokens.some(isVariableReference)) return true
      if (script.tokens.some((token) => token.dynamic)) return false
      return containsUnsupportedDynamicScript(script.source)
    }
    const containsDirectOpenCodeCommand = (source) => {
      const executable = withoutHeredocBodies(source)
      return (
        shellCommands(executable.source).map(withoutRedirections).some(commandRunsOpenCode) ||
        shellSubcommands(executable.source).some(containsDirectOpenCodeCommand) ||
        executable.subcommands.some(containsDirectOpenCodeCommand)
      )
    }
    const containsUnsupportedDynamicExecutable = (source) => {
      const executable = withoutHeredocBodies(source)
      return (
        shellCommands(executable.source).map(withoutRedirections).some(commandUsesDynamicExecutable) ||
        shellSubcommands(executable.source).some(containsUnsupportedDynamicExecutable) ||
        executable.subcommands.some(containsUnsupportedDynamicExecutable)
      )
    }
    const containsUnsupportedDynamicScript = (source) => {
      const executable = withoutHeredocBodies(source)
      return (
        shellCommands(executable.source).map(withoutRedirections).some(commandUsesDynamicScript) ||
        shellSubcommands(executable.source).some(containsUnsupportedDynamicScript) ||
        executable.subcommands.some(containsUnsupportedDynamicScript)
      )
    }
    const tokenizeJavaScript = (source) => {
      const tokens = []
      const templateQuote = String.fromCharCode(96)
      for (let index = 0; index < source.length; ) {
        const character = source[index]
        if (/\s/.test(character)) {
          index++
          continue
        }
        if (character === "/" && source[index + 1] === "/") {
          index += 2
          while (index < source.length && source[index] !== "\n") index++
          continue
        }
        if (character === "/" && source[index + 1] === "*") {
          index += 2
          while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) index++
          index = Math.min(source.length, index + 2)
          continue
        }
        const previous = tokens.at(-1)?.value
        const regexCanStart =
          !previous ||
          ["=", "(", "[", "{", ",", ":", ";", "return", "=>", "!", "?", "&&", "||"].includes(previous)
        if (
          character === "/" &&
          source[index + 1] !== "/" &&
          source[index + 1] !== "*" &&
          regexCanStart
        ) {
          let cursor = index + 1
          let escaped = false
          let inCharacterClass = false
          while (cursor < source.length) {
            const current = source[cursor++]
            if (escaped) {
              escaped = false
              continue
            }
            if (current === "\\") {
              escaped = true
              continue
            }
            if (current === "[") inCharacterClass = true
            else if (current === "]") inCharacterClass = false
            else if (current === "/" && !inCharacterClass) break
          }
          while (/[A-Za-z]/.test(source[cursor] ?? "")) cursor++
          tokens.push({ type: "regex", value: source.slice(index, cursor) })
          index = cursor
          continue
        }
        if (character === "'" || character === '"' || character === templateQuote) {
          const quote = character
          const type = quote === templateQuote ? "template" : "string"
          index++
          let value = ""
          while (index < source.length) {
            const current = source[index++]
            if (current === quote) break
            if (current !== "\\") {
              value += current
              continue
            }
            const escaped = source[index++]
            if (escaped === "n") value += "\n"
            else if (escaped === "r") value += "\r"
            else if (escaped === "t") value += "\t"
            else if (escaped === "b") value += "\b"
            else if (escaped === "f") value += "\f"
            else value += escaped ?? ""
          }
          tokens.push({ type, value })
          continue
        }
        if (/[A-Za-z_$]/.test(character)) {
          const start = index++
          while (/[A-Za-z0-9_$]/.test(source[index] ?? "")) index++
          tokens.push({ type: "identifier", value: source.slice(start, index) })
          continue
        }
        tokens.push({ type: "punctuation", value: character })
        index++
      }
      return tokens
    }
    const containsDirectOpenCodeScript = (source) => {
      const tokens = tokenizeJavaScript(source)
      const processFunctions = new Set([
        "exec",
        "execSync",
        "spawn",
        "spawnSync",
        "execFile",
        "execFileSync",
      ])
      for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index]
        if (
          processFunctions.has(token.value) &&
          [":", "as"].includes(tokens[index + 1]?.value) &&
          tokens[index + 2]?.type === "identifier"
        ) {
          processFunctions.add(tokens[index + 2].value)
        }
        if (
          token.type === "identifier" &&
          tokens[index + 1]?.value === "=" &&
          tokens[index + 2]?.type === "identifier" &&
          processFunctions.has(tokens[index + 2].value)
        ) {
          processFunctions.add(token.value)
        }
      }
      const variables = new Map()
      for (let index = 0; index < tokens.length; index++) {
        if (
          ["const", "let", "var"].includes(tokens[index].value) &&
          tokens[index + 1]?.type === "identifier" &&
          tokens[index + 2]?.value === "="
        ) {
          const value = tokens[index + 3]
          if (value?.type === "string" || value?.type === "template") {
            variables.set(tokens[index + 1].value, value.value)
          }
        }
      }
      const expandTemplate = (value) =>
        value.replace(
          new RegExp("\\$\\{([A-Za-z_$][A-Za-z0-9_$]*)\\}", "g"),
          (_, name) => variables.get(name) ?? "",
        )
      const readExpression = (start) => {
        const first = tokens[start]
        if (!first) return { value: undefined, end: start + 1 }
        let value
        let end = start + 1
        if (first.type === "string") value = first.value
        else if (first.type === "template") value = expandTemplate(first.value)
        else if (first.type === "identifier" && variables.has(first.value)) value = variables.get(first.value)
        while (tokens[end]?.value === "+") {
          const next = tokens[end + 1]
          if (next?.type === "string") value = String(value ?? "") + next.value
          else if (next?.type === "template") value = String(value ?? "") + expandTemplate(next.value)
          else break
          end += 2
        }
        return { value, end }
      }
      const parseArray = (start) => {
        if (tokens[start]?.value !== "[") return undefined
        const values = []
        let index = start + 1
        while (index < tokens.length && tokens[index].value !== "]") {
          if (tokens[index].value === ",") {
            index++
            continue
          }
          const expression = readExpression(index)
          if (expression.value === undefined) {
            return { values, dynamic: true, end: index + 1 }
          }
          values.push({ value: expression.value, dynamic: false })
          index = expression.end
        }
        return { values, dynamic: false, end: index + 1 }
      }
      const isOpenCodeExecutable = (value) =>
        ["opencode", "opencode.exe"].includes(executableName(value ?? ""))
      for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index]
        if (processFunctions.has(token.value) && tokens[index + 1]?.value === "(") {
          const executable = readExpression(index + 2)
          if (executable.value !== undefined && containsDirectOpenCodeCommand(executable.value)) return true
          if (
            executable.value !== undefined &&
            isOpenCodeExecutable(executable.value) &&
            tokens[executable.end]?.value === ","
          ) {
            const argv = parseArray(executable.end + 1)
            if (argv?.dynamic || (argv && hasOpenCodeRunArguments(argv.values, 0))) return true
          }
        }
        if (
          token.value === "Bun" &&
          tokens[index + 1]?.value === "." &&
          tokens[index + 2]?.value === "spawn" &&
          tokens[index + 3]?.value === "("
        ) {
          const argv = parseArray(index + 4)
          if (argv?.values.length && isOpenCodeExecutable(argv.values[0].value)) {
            if (argv.dynamic || hasOpenCodeRunArguments(argv.values, 1)) return true
          }
        }
        if (token.value === "$" && tokens[index + 1]?.type === "template") {
          if (containsDirectOpenCodeCommand(expandTemplate(tokens[index + 1].value))) return true
        }
      }
      return false
    }

    const inspect = (name, workflow) => {
      const findings = []
      const visit = (value, location) => {
        if (Array.isArray(value)) {
          value.forEach((entry, index) => visit(entry, `${location}[${index}]`))
          return
        }
        if (!value || typeof value !== "object") return
        for (const [key, entry] of Object.entries(value)) {
          if (key === "model") findings.push(`${name}: workflow model selector at ${location}.${key}`)
          if (providerCredentials.includes(key)) {
            findings.push(`${name}: provider credential at ${location}.${key}`)
          }
          if (typeof entry === "string") {
            if (providerCredentials.some((credential) => entry.includes(credential))) {
              findings.push(`${name}: provider credential text at ${location}.${key}`)
            }
            if (key === "uses" && modelActionPrefixes.some((prefix) => entry.startsWith(prefix))) {
              findings.push(`${name}: direct model action at ${location}.${key}`)
            }
            if (key === "shell") {
              const normalizedShell = entry.replace(/[\\`]\r?\n/g, "")
              if (normalizedShell.includes("$'")) {
                findings.push(`${name}: unsupported ANSI-C shell construction at ${location}.${key}`)
              }
              if (containsDirectOpenCodeCommand(normalizedShell)) {
                findings.push(`${name}: direct OpenCode shell at ${location}.${key}`)
              }
              if (containsUnsupportedDynamicExecutable(normalizedShell)) {
                findings.push(`${name}: unsupported dynamic executable at ${location}.${key}`)
              }
              if (containsUnsupportedDynamicScript(normalizedShell)) {
                findings.push(`${name}: unsupported dynamic script at ${location}.${key}`)
              }
            }
            if (key === "run") {
              const normalizedCommand = entry.replace(/[\\`]\r?\n/g, "")
              if (normalizedCommand.includes("$'")) {
                findings.push(`${name}: unsupported ANSI-C shell construction at ${location}.${key}`)
              }
              if (containsDirectOpenCodeCommand(normalizedCommand)) {
                findings.push(`${name}: direct OpenCode command at ${location}.${key}`)
              }
              if (containsUnsupportedDynamicExecutable(normalizedCommand)) {
                findings.push(`${name}: unsupported dynamic executable at ${location}.${key}`)
              }
              if (containsUnsupportedDynamicScript(normalizedCommand)) {
                findings.push(`${name}: unsupported dynamic script at ${location}.${key}`)
              }
              if (entry.includes("opencode.ai/install") || entry.includes("opencode-ai")) {
                findings.push(`${name}: mutable OpenCode installation at ${location}.${key}`)
              }
              if (modelAutomationEntrypoints.some((script) => entry.includes(script))) {
                findings.push(`${name}: model automation entrypoint at ${location}.${key}`)
              }
            }
          }
          visit(entry, `${location}.${key}`)
        }
      }
      visit(workflow, name)
      return findings
    }

    expect(workflowNames.filter((name) => retiredWorkflows.includes(name))).toEqual([])

    const actualAutomationDigests = {}
    for (const file of automationFiles) {
      const name = path.relative(repositoryRoot, file)
      const workflow = Bun.YAML.parse(await Bun.file(file).text())
      const digest = new Bun.CryptoHasher("sha256")
      digest.update(JSON.stringify(workflow))
      actualAutomationDigests[name] = digest.digest("hex")
    }
    expect(actualAutomationDigests).toEqual(expectedAutomationDigests)

    for (const file of automationFiles) {
      const name = path.relative(repositoryRoot, file)
      const source = await Bun.file(file).text()
      const workflow = Bun.YAML.parse(source)
      violations.push(...inspect(name, workflow))
    }

    expect(violations).toEqual([])
    expect(
      inspect("mutation.yaml", {
        jobs: {
          review: {
            steps: [
              { uses: "anomalyco/opencode/github@0123456789abcdef" },
              { run: "bun install --global opencode-ai" },
              { run: "OPENCODE_CONFIG=/tmp/review.json opencode run review" },
              { run: "env OPENCODE_CONFIG=/tmp/review.json opencode run review" },
              { run: "exec opencode run review" },
              { run: "command opencode run review" },
              { run: "bash -c 'opencode run review'" },
              { run: "/usr/local/bin/opencode run review" },
              { run: '"opencode" run review' },
              { run: "'/usr/local/bin/opencode' run review" },
              { run: "opencode 'run' review" },
              { run: "opencode --print-logs run review" },
              { run: "opencode --log-level DEBUG run review" },
              { run: "opencode --pure run review" },
              { run: "opencode --pure --print-logs --log-level=DEBUG run review" },
              { run: 'opencode --log-level "DEBUG" run review' },
              { run: 'opencode "--log-level=DEBUG" run review' },
              { run: 'opencode "--pure" run review' },
              { run: "opencode --pure=false run review" },
              { run: "opencode --no-print-logs run review" },
              { run: 'opencode --pure="false" run review' },
              { run: "opencode --print-logs='true' run review" },
              { run: 'opencode "--log-level"=DEBUG run review' },
              { run: "opencode \\\n  run review" },
              { run: "opencode \\\n  --pure \\\n  run review" },
              { run: "opencode --log-level \\\n  DEBUG \\\n  run review" },
              { run: "opencode `\n  --pure `\n  run review" },
              { run: "opencode --log-level=\\\nDEBUG run review" },
              { run: "opencode --pure=\\\nfalse run review" },
              { run: "opencode --log-level\\\n=DEBUG run review" },
              { run: '& "C:\\Program Files\\opencode.exe" run review' },
              { run: "open''code run review" },
              { run: "opencode r''un review" },
              { run: "opencode \\r\\u\\n review" },
              { run: "opencode --pu''re run review" },
              { run: `opencode --log-level D"E"B'U'G run review` },
              { run: "opencode --pr''int-logs run review" },
              { run: "opencode --no-p''ure run review" },
              { run: "opencode --pure=tr''ue run review" },
              { run: "open''code.e''xe r\\un review" },
              { run: "open$''code run review" },
              { run: String.raw`open$'\x63'ode run review` },
              { run: 'open""code run review' },
              { run: "open$'co'de run review" },
              { run: "opencode $'run' review" },
              { run: String.raw`open$'\u63'ode run review` },
              { run: String.raw`opencode $'\162un' review` },
              { run: "open$\\\n'co'de run review" },
              { run: "echo safe; opencode run review" },
              { run: "if opencode run review; then echo done; fi" },
              { run: 'echo "$(opencode run review)"' },
              { run: "echo `opencode run review`" },
              { run: "env -i OPENCODE_CONFIG=/tmp/review.json opencode run review" },
              { run: "command -- opencode run review" },
              { run: "echo '<<EOF'\nopencode run review" },
              { run: "# <<EOF\nopencode run review" },
              { run: "bash -lc 'opencode run review'" },
              { run: "cat <<EOF\n$(opencode run review)\nEOF" },
              { run: 'OPENCODE_CONFIG="$RUNNER_TEMP/review.json" opencode run review' },
              { run: "OPENCODE_CONFIG='$(echo safe)' opencode run review" },
              { run: "env -u FOO opencode run review" },
              { run: "exec -a audit opencode run review" },
              { run: "if false; then :; else opencode run review; fi" },
              { run: "time opencode run review" },
              { run: "pwsh -Command opencode run review" },
              { run: 'eval "opencode run review"' },
              { run: 'TOOL=opencode; "$TOOL" run review' },
              { shell: "opencode run {0}", run: "review" },
              { run: "TOOL=opencode; ${TOOL} run review" },
              { run: 'CMD="opencode run review"; eval "$CMD"' },
              { run: 'CMD="opencode run review"; bash -c "$CMD"' },
              { run: 'CMD="opencode run review"; sh -c "$CMD"' },
              { run: 'CMD="opencode run review"; pwsh -Command "$CMD"' },
              { run: ">/tmp/review.log opencode run review" },
              { run: "2>/tmp/error.log opencode run review" },
              { run: "<input opencode run review" },
              { run: "2>&1 opencode run review" },
              { run: "&>/tmp/review.log opencode run review" },
              { run: "& $env:TOOL run review" },
              { run: "& ${env:TOOL} run review" },
              { run: 'CMD="opencode run review"; eval \'$CMD\'' },
              { run: 'CMD="opencode run review" bash -c \'$CMD\'' },
              { run: "env >/tmp/log opencode run review" },
              { run: "command >/tmp/log opencode run review" },
              { run: "exec >/tmp/log opencode run review" },
              { run: "time >/tmp/log opencode run review" },
              { run: "opencode >/tmp/log run review" },
              { run: "opencode --pure 2>/tmp/error run review" },
              { run: "/usr/bin/time -f %E opencode run review" },
              { run: "/usr/bin/time --output /tmp/time.log opencode run review" },
              { run: "env -S 'opencode run review'" },
              { run: "env --split-string='opencode run review'" },
              { run: 'CMD="opencode run review"; env -S "$CMD"' },
              { run: "command env opencode run review" },
              { run: "exec env opencode run review" },
              { run: "time env opencode run review" },
              { run: "command command opencode run review" },
              { run: 'command env "$TOOL" run review' },
              { run: 'command bash -c "$CMD"' },
              { run: 'command env -S "$CMD"' },
              { run: `bash -c '"$TOOL" run review'` },
              { run: `bash -c 'bash -c "$CMD"'` },
              { run: `eval 'bash -c "$CMD"'` },
              { run: "env -S 'bash -c' 'opencode run review'" },
              { run: String.raw`env -S 'opencode\_run review'` },
              { run: `env -S '${"env ".repeat(40)}opencode run review'` },
              { run: "env -S 'env # comment' opencode run review" },
              { run: "env -S'opencode run review'" },
              { run: "env -iS'opencode run review'" },
              { run: "command env -S'opencode run review'" },
            ],
          },
        },
      }),
    ).toEqual([
      "mutation.yaml: direct model action at mutation.yaml.jobs.review.steps[0].uses",
      "mutation.yaml: mutable OpenCode installation at mutation.yaml.jobs.review.steps[1].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[2].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[3].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[4].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[5].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[6].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[7].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[8].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[9].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[10].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[11].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[12].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[13].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[14].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[15].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[16].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[17].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[18].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[19].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[20].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[21].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[22].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[23].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[24].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[25].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[26].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[27].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[28].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[29].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[30].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[31].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[32].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[33].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[34].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[35].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[36].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[37].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[38].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[39].run",
      "mutation.yaml: unsupported ANSI-C shell construction at mutation.yaml.jobs.review.steps[40].run",
      "mutation.yaml: unsupported ANSI-C shell construction at mutation.yaml.jobs.review.steps[41].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[42].run",
      "mutation.yaml: unsupported ANSI-C shell construction at mutation.yaml.jobs.review.steps[43].run",
      "mutation.yaml: unsupported ANSI-C shell construction at mutation.yaml.jobs.review.steps[44].run",
      "mutation.yaml: unsupported ANSI-C shell construction at mutation.yaml.jobs.review.steps[45].run",
      "mutation.yaml: unsupported ANSI-C shell construction at mutation.yaml.jobs.review.steps[46].run",
      "mutation.yaml: unsupported ANSI-C shell construction at mutation.yaml.jobs.review.steps[47].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[48].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[49].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[50].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[51].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[52].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[53].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[54].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[55].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[56].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[57].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[58].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[59].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[60].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[61].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[62].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[63].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[64].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[65].run",
      "mutation.yaml: unsupported dynamic executable at mutation.yaml.jobs.review.steps[66].run",
      "mutation.yaml: direct OpenCode shell at mutation.yaml.jobs.review.steps[67].shell",
      "mutation.yaml: unsupported dynamic executable at mutation.yaml.jobs.review.steps[68].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[69].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[70].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[71].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[72].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[73].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[74].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[75].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[76].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[77].run",
      "mutation.yaml: unsupported dynamic executable at mutation.yaml.jobs.review.steps[78].run",
      "mutation.yaml: unsupported dynamic executable at mutation.yaml.jobs.review.steps[79].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[80].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[81].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[82].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[83].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[84].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[85].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[86].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[87].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[88].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[89].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[90].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[91].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[92].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[93].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[94].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[95].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[96].run",
      "mutation.yaml: unsupported dynamic executable at mutation.yaml.jobs.review.steps[97].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[98].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[99].run",
      "mutation.yaml: unsupported dynamic executable at mutation.yaml.jobs.review.steps[100].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[101].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[102].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[103].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[104].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[105].run",
      "mutation.yaml: direct OpenCode command at mutation.yaml.jobs.review.steps[106].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[107].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[108].run",
      "mutation.yaml: unsupported dynamic script at mutation.yaml.jobs.review.steps[109].run",
    ])
    expect(
      inspect("negative-mutation.yaml", {
        jobs: {
          review: {
            steps: [
              { run: "my-opencode --pure run review" },
              { run: "opencode --pureful run review" },
              { run: "opencode --log-level WARNING run review" },
              { run: "opencode\\\nrun review" },
              { run: "opencode --pure\\\nrun review" },
              { run: "my-open''code run review" },
              { run: "opencode r''unner review" },
              { run: "opencode --pu''reful run review" },
              { run: `opencode --log-level D"E"B'U'GG run review` },
              { run: 'open"$TOOL"code run review' },
              { run: "opencode 'r un' review" },
              { run: "opencode --pr''int-logs-extra run review" },
              { run: "opencode --pure=tr''uest run review" },
              { run: "open''code.e''xtra run review" },
              { run: "open$TOOLcode run review" },
              { run: "echo open''code run review" },
              { run: "printf '%s\\n' opencode run review" },
              { run: "x=open''code run review" },
              { run: "# opencode run review" },
              { run: "bash -c 'echo opencode run review'" },
              { run: "opencode='opencode run review' echo \"$opencode\"" },
              { run: 'echo "opencode run review"' },
              { run: "command -v opencode run review" },
              { run: "echo '$(opencode run review)'" },
              { run: "cat <<'EOF'\nopencode run review\nEOF" },
              { run: "cat <<E''OF\nopencode run review\nEOF" },
              { run: "cat <<EOF\nopencode run review\nEOF" },
              { run: '"" opencode run review' },
              { run: "if echo opencode run review; then echo done; fi" },
              { run: '""#comment opencode run review' },
              { run: "command -p -v opencode run review" },
              { run: "command -pv opencode run review" },
              { run: 'echo "$TOOL run review"' },
              { run: 'TOOL=echo; "$TOOL" opencode run review' },
              { run: "echo safe # $(opencode run review)" },
              { run: "# `opencode run review`" },
              { run: "exec command -v opencode run review" },
              { run: "command command -V opencode run review" },
              { run: `env -S 'printf "%s\\n" opencode && opencode run review'` },
              { run: String.raw`env -S "'opencode\_run' review"` },
            ],
          },
        },
      }),
    ).toEqual([])
  })

  test("rejects direct model execution hidden in inline JavaScript actions", () => {
    expect(
      inspect("script-mutation.yaml", {
        jobs: {
          review: {
            steps: [
              { with: { script: 'require("node:child_process").execSync("opencode run review")' } },
              { with: { script: 'spawnSync("/usr/local/bin/opencode.exe", ["run", "review"])' } },
              { with: { script: 'Bun.spawn(["/usr/local/bin/opencode", "--pure", "run", "review"])' } },
              { with: { script: 'const cli = "opencode"; spawn(cli, ["run", "review"])' } },
              { with: { script: 'const { execSync: run } = require("node:child_process"); run("opencode" + " run review")' } },
            ],
          },
        },
      }),
    ).toEqual([
      "script-mutation.yaml: direct OpenCode script execution at script-mutation.yaml.jobs.review.steps[0].with.script",
      "script-mutation.yaml: direct OpenCode script execution at script-mutation.yaml.jobs.review.steps[1].with.script",
      "script-mutation.yaml: direct OpenCode script execution at script-mutation.yaml.jobs.review.steps[2].with.script",
      "script-mutation.yaml: direct OpenCode script execution at script-mutation.yaml.jobs.review.steps[3].with.script",
      "script-mutation.yaml: direct OpenCode script execution at script-mutation.yaml.jobs.review.steps[4].with.script",
    ])
    expect(
      inspect("script-negative.yaml", {
        jobs: {
          review: {
            steps: [
              { with: { script: '// execSync("opencode run review")\nconst note = "safe"' } },
              { with: { script: 'const note = "opencode run review"' } },
              { with: { script: 'execSync("echo opencode run review")' } },
              { with: { script: 'spawnSync("echo", ["opencode", "run", "review"])' } },
              { with: { script: 'const note = \x60execSync("opencode run review")\x60' } },
              { with: { script: 'const note = /execSync\\("opencode run review"\\)/' } },
            ],
          },
        },
      }),
    ).toEqual([])
  })

  test("keeps the release call graph model-free and exact", async () => {
    const workflow = Bun.YAML.parse(await Bun.file(path.join(workflowDirectory, "publish.yml")).text())

    expect(workflow.jobs.version.steps).toEqual([
      {
        uses: "actions/checkout@f43a0e5ff2bd294095638e18286ca9a3d1956744",
        with: { "fetch-depth": 0 },
      },
      { uses: "./.github/actions/setup-bun" },
      {
        name: "Setup git committer",
        id: "committer",
        uses: "./.github/actions/setup-git-committer",
        with: {
          "opencode-app-id": "${{ vars.OPENCODE_APP_ID }}",
          "opencode-app-secret": "${{ secrets.OPENCODE_APP_SECRET }}",
        },
      },
      {
        id: "version",
        run: "./script/version.ts\n",
        env: {
          GH_TOKEN: "${{ steps.committer.outputs.token }}",
          OPENCODE_BUMP: "${{ inputs.bump }}",
          OPENCODE_VERSION: "${{ inputs.version }}",
          GH_REPO: "${{ (github.ref_name == 'beta' && 'anomalyco/opencode-beta') || github.repository }}",
        },
      },
    ])
    expect(await Bun.file(path.join(repositoryRoot, "script/version.ts")).text()).toBe(expectedVersionScript)
    expect(existsSync(path.join(repositoryRoot, "script/changelog.ts"))).toBe(false)
    expect(existsSync(path.join(repositoryRoot, ".opencode/command/changelog.md"))).toBe(false)
  })
})
