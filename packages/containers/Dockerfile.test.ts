import { describe, expect, test } from "bun:test"

const names = ["base", "bun-node", "rust", "tauri-linux", "publish"]
const sources = Object.fromEntries(
  await Promise.all(
    names.map(async (name) => [name, await Bun.file(new URL(`./${name}/Dockerfile`, import.meta.url)).text()]),
  ),
)

describe("shared build-container runtime identity", () => {
  test("the base image owns the fixed build account", () => {
    const instructions = dockerfileInstructions(sources.base)
    expect(
      instructions.some(
        (line) =>
          line.startsWith("RUN ") &&
          line.includes("groupadd --gid 10001 build_agent") &&
          line.includes("useradd --uid 10001 --gid 10001 --create-home --shell /bin/bash build_agent"),
      ),
    ).toBe(true)
    expect(instructions.some((line) => line.startsWith("ENV ") && line.includes("HOME=/home/build_agent"))).toBe(true)
  })

  test("every published image finishes as the shared non-root account", () => {
    for (const name of names) {
      expect(dockerfileInstructions(sources[name]).at(-1), name).toBe("USER build_agent:build_agent")
    }
  })

  test("derived images elevate only for provisioning and do not recreate the account", () => {
    for (const name of names.slice(1)) {
      const instructions = dockerfileInstructions(sources[name])
      expect(instructions.indexOf("USER root"), name).toBeGreaterThan(0)
      expect(instructions.indexOf("USER root"), name).toBeLessThan(instructions.findIndex((line) => line.startsWith("RUN ")))
      expect(instructions.some((line) => /\b(?:groupadd|useradd)\b/.test(line)), name).toBe(false)
    }
  })
})

function dockerfileInstructions(source: string) {
  return source
    .replace(/\\\n\s*/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("ARG "))
}
