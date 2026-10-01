import { expect, test } from "bun:test"

const reviewedCacheCommit = "0057852bfaa89a56745cba8c7296529d2fc39830"

function cacheRefs(source: string) {
  const action = Bun.YAML.parse(source) as { runs?: { steps?: Array<{ uses?: unknown }> } }
  return (
    action.runs?.steps?.flatMap((step) =>
      typeof step.uses === "string" && step.uses.startsWith("actions/cache@")
        ? [step.uses.slice("actions/cache@".length)]
        : [],
    ) ?? []
  )
}

test("published GitHub Action pins actions/cache to the reviewed commit", async () => {
  const action = await Bun.file(new URL("../../../../github/action.yml", import.meta.url)).text()

  expect(cacheRefs(action)).toEqual([reviewedCacheCommit])
})

test("reads executable steps instead of inert YAML text", () => {
  const action = `
description: |
  uses: actions/cache@${reviewedCacheCommit}
runs:
  using: composite
  steps:
    - uses: "actions/cache@v4"
`

  expect(cacheRefs(action)).toEqual(["v4"])
})
