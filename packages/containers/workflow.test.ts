import { expect, test } from "bun:test"

const source = await Bun.file(new URL("../../.github/workflows/containers.yml", import.meta.url)).text()
const workflow = Bun.YAML.parse(source) as {
  on?: { pull_request?: { paths?: unknown } }
  permissions?: Record<string, unknown>
  concurrency?: { group?: unknown; "cancel-in-progress"?: unknown }
  jobs?: Record<
    string,
    {
      if?: unknown
      permissions?: Record<string, unknown>
      steps?: Array<{ name?: unknown; if?: unknown; run?: unknown; env?: Record<string, unknown> }>
    }
  >
}

test("pull requests build every container without publishing it", () => {
  expect(workflow.on?.pull_request?.paths).toContain("packages/containers/**")

  expect(workflow.jobs?.build?.if).toBe("github.event_name == 'pull_request'")
  const step = workflow.jobs?.build?.steps?.find((candidate) => candidate.name === "Build containers")
  expect(step?.run).toBe("bun ./packages/containers/script/build.ts")
  expect(step?.env?.PUSH).toBe("0")

  const login = workflow.jobs?.build?.steps?.find((candidate) => candidate.name === "Login to GHCR")
  expect(login).toBeUndefined()
})

test("pull request builds cannot write packages", () => {
  expect(workflow.permissions?.packages).toBeUndefined()
  expect(workflow.jobs?.build?.permissions?.packages).toBeUndefined()

  expect(workflow.jobs?.publish?.if).toBe("github.event_name != 'pull_request'")
  expect(workflow.jobs?.publish?.permissions?.packages).toBe("write")

  const login = workflow.jobs?.publish?.steps?.find((candidate) => candidate.name === "Login to GHCR")
  expect(login).toBeDefined()

  const step = workflow.jobs?.publish?.steps?.find((candidate) => candidate.name === "Build and publish containers")
  expect(step?.env?.PUSH).toBe("1")
})

test("a newer revision cancels the stale container build", () => {
  expect(workflow.concurrency?.group).toBe(
    "${{ format('{0}-{1}', github.workflow, github.event.pull_request.number || github.ref) }}",
  )
  expect(workflow.concurrency?.["cancel-in-progress"]).toBe(true)
})
