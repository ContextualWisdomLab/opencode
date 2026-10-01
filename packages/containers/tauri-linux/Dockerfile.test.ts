import { describe, expect, test } from "bun:test"

const dockerfile = await Bun.file(new URL("./Dockerfile", import.meta.url)).text()
const instructions = dockerfile
  .replace(/\\\n\s*/g, " ")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))

describe("tauri-linux production image", () => {
  test("runs as the fixed non-root runtime identity", () => {
    expect(dockerfile).toContain("groupadd --gid 10001 tauri")
    expect(dockerfile).toContain("useradd --uid 10001 --gid 10001")
    expect(dockerfile).toContain("ENV HOME=/home/tauri")
    expect(instructions.at(-1)).toBe("USER tauri:tauri")
  })

  test("keeps package caches in the runtime identity home", () => {
    expect(dockerfile).toContain("CARGO_HOME=/home/tauri/.cargo")
    expect(dockerfile).toContain("BUN_INSTALL_CACHE_DIR=/home/tauri/.cache/bun")
  })
})
