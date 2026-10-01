import { describe, expect, test } from "bun:test"

const names = ["base", "bun-node", "rust", "tauri-linux", "publish"]
const sources = Object.fromEntries(
  await Promise.all(
    names.map(async (name) => [name, await Bun.file(new URL(`./${name}/Dockerfile`, import.meta.url)).text()]),
  ),
)

describe("shared build-container runtime identity", () => {
  test("the base image owns the fixed build account", () => {
    expect(hasBaseIdentity(sources.base)).toBe(true)
  })

  test("every published image finishes as the shared non-root account", () => {
    for (const name of names) {
      expect(dockerfileInstructions(sources[name]).at(-1), name).toBe("USER build_agent:build_agent")
    }
  })

  test("derived images elevate only for provisioning and do not recreate the account", () => {
    for (const name of names.slice(1)) {
      expect(hasDerivedIdentity(sources[name]), name).toBe(true)
    }
  })

  test("rejects identity evidence placed only in a discarded stage", () => {
    const baseBypass = `
FROM ubuntu:24.04 AS discarded
RUN groupadd --gid 10001 build_agent && useradd --uid 10001 --gid 10001 --create-home --shell /bin/bash build_agent
ENV HOME=/home/build_agent
FROM scratch
USER build_agent:build_agent
`
    const childBypass = `
FROM ubuntu:24.04 AS discarded
USER root
RUN apt-get update
FROM scratch
USER build_agent:build_agent
`
    expect(hasBaseIdentity(baseBypass)).toBe(false)
    expect(hasDerivedIdentity(childBypass)).toBe(false)
  })
})

function hasBaseIdentity(source: string) {
  const instructions = dockerfileInstructions(source)
  return (
    instructions.some(
      (line) =>
        line.startsWith("RUN ") &&
        line.includes("groupadd --gid 10001 build_agent") &&
        line.includes("useradd --uid 10001 --gid 10001 --create-home --shell /bin/bash build_agent"),
    ) &&
    instructions.some((line) => line.startsWith("ENV ") && line.includes("HOME=/home/build_agent"))
  )
}

function hasDerivedIdentity(source: string) {
  const instructions = dockerfileInstructions(source)
  return (
    instructions.indexOf("USER root") > 0 &&
    instructions.indexOf("USER root") < instructions.findIndex((line) => line.startsWith("RUN ")) &&
    !instructions.some((line) => /\b(?:groupadd|useradd)\b/.test(line))
  )
}

function dockerfileInstructions(source: string) {
  const instructions = source
    .replace(/\\\n\s*/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("ARG "))
  return instructions.slice(instructions.findLastIndex((line) => line.startsWith("FROM ")))
}
