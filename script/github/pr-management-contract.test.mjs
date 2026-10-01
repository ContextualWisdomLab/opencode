import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("fork PR management workflow exposes only contributor labeling", async () => {
  const workflow = Bun.YAML.parse(
    await readFile(new URL("../../.github/workflows/pr-management.yml", import.meta.url), "utf8"),
  )

  assert.deepEqual(workflow.on, {
    pull_request_target: {
      types: ["opened"],
    },
  })
  assert.deepEqual(Object.keys(workflow.jobs), ["add-contributor-label"])
  assert.deepEqual(workflow.jobs["add-contributor-label"], {
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
  })
})
