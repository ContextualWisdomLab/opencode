import { expect, test } from "bun:test"

const source = await Bun.file(new URL("../../.github/workflows/containers.yml", import.meta.url)).text()
const workflow = Bun.YAML.parse(source) as {
  on?: { pull_request?: { paths?: unknown } }
  concurrency?: { group?: unknown; "cancel-in-progress"?: unknown }
  jobs?: { build?: { steps?: Array<{ name?: unknown; if?: unknown; run?: unknown; env?: Record<string, unknown> }> } }
}

test("pull requests build every container without publishing it", () => {
  expect(workflow.on?.pull_request?.paths).toContain("packages/containers/**")

  const step = workflow.jobs?.build?.steps?.find((candidate) => candidate.name === "Build containers")
  expect(step?.run).toBe("bun ./packages/containers/script/build.ts")
  expect(step?.env?.PUSH).toBe("${{ github.event_name == 'pull_request' && '0' || '1' }}")

  const login = workflow.jobs?.build?.steps?.find((candidate) => candidate.name === "Login to GHCR")
  expect(login?.if).toBe("github.event_name != 'pull_request'")
})

test("a newer revision cancels the stale container build", () => {
  expect(workflow.concurrency?.group).toBe(
    "${{ format('{0}-{1}', github.workflow, github.event.pull_request.number || github.ref) }}",
  )
  expect(workflow.concurrency?.["cancel-in-progress"]).toBe(true)
})
