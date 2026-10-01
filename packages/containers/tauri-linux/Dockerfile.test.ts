import { describe, expect, test } from "bun:test"

const dockerfile = await Bun.file(new URL("./Dockerfile", import.meta.url)).text()

describe("tauri-linux production image", () => {
  test("runs as the fixed non-root runtime identity", () => {
    expect(hasRuntimeIdentity(dockerfile)).toBe(true)
  })

  test("keeps package caches in the runtime identity home", () => {
    expect(hasWritableCaches(dockerfile)).toBe(true)
  })

  test("rejects required text outside the final runtime stage", () => {
    const bypass = `
FROM ubuntu:24.04 AS discarded
# USER root
# ENV CARGO_HOME=/home/build_agent/.cargo BUN_INSTALL_CACHE_DIR=/home/build_agent/.cache/bun
FROM scratch
USER build_agent:build_agent
`
    expect(hasRuntimeIdentity(bypass)).toBe(false)
    expect(hasWritableCaches(bypass)).toBe(false)
  })
})

function finalStageInstructions(source: string) {
  const instructions = source
    .replace(/\\\n\s*/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
  return instructions.slice(instructions.findLastIndex((line) => line.startsWith("FROM ")))
}

function hasRuntimeIdentity(source: string) {
  const instructions = finalStageInstructions(source)
  return (
    instructions.includes("USER root") &&
    instructions.indexOf("USER root") < instructions.findIndex((line) => line.startsWith("RUN ")) &&
    instructions.at(-1) === "USER build_agent:build_agent"
  )
}

function hasWritableCaches(source: string) {
  return finalStageInstructions(source).some(
    (line) =>
      line.startsWith("ENV ") &&
      line.includes("CARGO_HOME=/home/build_agent/.cargo") &&
      line.includes("BUN_INSTALL_CACHE_DIR=/home/build_agent/.cache/bun"),
  )
}
