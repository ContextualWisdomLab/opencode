import { expect, test } from "bun:test"

const reviewedCacheCommit = "0057852bfaa89a56745cba8c7296529d2fc39830"

function cacheRefs(source: string) {
  const action = Bun.YAML.parse(source) as { runs?: { steps?: Array<{ uses?: unknown }> } }
  return (
    action.runs?.steps?.flatMap((step) => {
      if (typeof step.uses !== "string") return []
      const separator = step.uses.lastIndexOf("@")
      if (separator < 0) return []
      const repository = step.uses.slice(0, separator).toLowerCase()
      if (repository !== "actions/cache" && !repository.startsWith("actions/cache/")) return []
      return [step.uses.slice(separator + 1)]
    }) ?? []
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

test("finds case-varied cache actions and cache sub-actions", () => {
  const action = `
runs:
  using: composite
  steps:
    - uses: actions/cache@${reviewedCacheCommit}
    - uses: Actions/Cache@v4
    - uses: actions/cache/restore@v4
    - uses: actions/cache/save@v4
    - uses: other/cache@v4
`

  expect(cacheRefs(action)).toEqual([reviewedCacheCommit, "v4", "v4", "v4"])
})
