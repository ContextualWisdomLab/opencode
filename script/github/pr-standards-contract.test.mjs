import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const workflow = readFileSync(new URL("../../.github/workflows/pr-standards.yml", import.meta.url), "utf8")
const complianceJob = workflow.match(/\n  check-compliance:[\s\S]*$/)?.[0] ?? ""

assert.match(workflow, /const issueTrackingEnabled = context\.payload\.repository\.has_issues/)
assert.match(workflow, /skipIssueCheck = [^\n]*!issueTrackingEnabled/)
assert.match(complianceJob, /const issueTrackingEnabled = context\.payload\.repository\.has_issues/)
assert.match(complianceJob, /if \(issueTrackingEnabled && !isDocsRefactorOrFeat && hasIssueSection\)/)

console.log("pr-standards disabled-issue contract: PASS")
