import { expect, test } from "bun:test"

const safeDependencyFloors = {
  "baseline-browser-mapping": "2.11.27",
  browserslist: "4.29.3",
  "fast-uri": "3.1.8",
  nanoid: "3.3.19",
  postcss: "8.5.28",
} as const

function lockedVersions(lockfile: string, packageName: string) {
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const versions = Array.from(
    lockfile.matchAll(new RegExp(`^    "[^"]+": \\["${escapedName}@([^"+]+)`, "gm")),
    (match) => match[1],
  )
  if (versions.length === 0) {
    throw new Error(`missing ${packageName} from GLM 5.2 video lockfile`)
  }
  return versions
}

test("GLM 5.2 video lock excludes scanner-confirmed vulnerable dependency ranges", async () => {
  const lockfile = await Bun.file(
    new URL("../../../../artifacts/glm52-rise-video/bun.lock", import.meta.url),
  ).text()

  for (const [packageName, minimumVersion] of Object.entries(safeDependencyFloors)) {
    for (const version of lockedVersions(lockfile, packageName)) {
      expect(Bun.semver.satisfies(version, `>=${minimumVersion}`), `${packageName}@${version}`).toBe(
        true,
      )
    }
  }
})

test("dependency-floor oracle fails closed when a lock entry is absent", () => {
  expect(() => lockedVersions('    "postcss": ["postcss@8.5.28"]', "nanoid")).toThrow(
    "missing nanoid",
  )
})

test("dependency-floor oracle enumerates nested duplicate versions", () => {
  const lockfile = [
    '    "nanoid": ["nanoid@3.3.19"]',
    '    "postcss/nanoid": ["nanoid@3.3.15"]',
  ].join("\n")

  expect(lockedVersions(lockfile, "nanoid")).toEqual(["3.3.19", "3.3.15"])
})
