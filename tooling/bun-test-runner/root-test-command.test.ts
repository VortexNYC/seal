import { expect, test } from "bun:test";

test("delegates bare bun test to the repo test script", () => {
  const result = Bun.spawnSync({
    cmd: ["bun", "run", "test"],
    cwd: new URL("../..", import.meta.url).pathname,
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      SEAL_BUN_TEST_DELEGATE: "1",
    },
  });

  expect(result.exitCode).toBe(0);
}, 120000);
