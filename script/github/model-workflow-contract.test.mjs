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
            if (key === "run") {
              if (/(?<![\w-])opencode(?:\.exe)?["']?\s+["']?run(?:["']|\b)/i.test(entry)) {
                findings.push(`${name}: direct OpenCode command at ${location}.${key}`)
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
              { run: '& "C:\\Program Files\\opencode.exe" run review' },
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
    ])
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
