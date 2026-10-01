import { expect, test } from "bun:test"

test("stats server image starts as its dedicated non-root identity", async () => {
  const dockerfile = await Bun.file(new URL("./Dockerfile", import.meta.url)).text()
  const instructions = dockerfile
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  expect(instructions.filter((line) => /^(?:RUN addgroup|&& adduser)/.test(line))).toEqual([
    "RUN addgroup -S -g 10001 stats \\",
    "&& adduser -S -D -u 10001 -G stats -h /home/stats stats",
  ])
  expect(instructions.slice(-3)).toEqual([
    "USER stats:stats",
    "ENV HOME=/home/stats",
    'CMD ["bun", "src/server.ts"]',
  ])
})
