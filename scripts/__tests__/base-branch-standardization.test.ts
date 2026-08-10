import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

function readJsonObject(rel: string): Record<string, unknown> {
  const value: unknown = JSON.parse(read(rel));
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${rel} must be a JSON object`);
  }
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    record[key] = entry;
  }
  return record;
}

describe("SEA-586 base branch standardization", () => {
  test("ci.yml targets only main", () => {
    const content = read(".github/workflows/ci.yml");
    expect(content).toContain("branches: [main]");
    expect(content).not.toContain("branches: [main, staging]");
  });

  test("guard.yml targets only main", () => {
    const content = read(".github/workflows/guard.yml");
    expect(content).toContain("branches: [main]");
    expect(content).not.toContain("branches: [main, staging]");
  });

  test("vortex-quality.yml and vortex-main-proof.yml target only main", () => {
    for (const file of [
      ".github/workflows/vortex-quality.yml",
      ".github/workflows/vortex-main-proof.yml",
    ]) {
      const content = read(file);
      expect(content).toContain("branches: [main]");
      expect(content).not.toContain("branches: [staging]");
    }
  });

  test("vortex.project.json and .test-env.example declare main", () => {
    const project = readJsonObject("vortex.project.json");
    const instructions = project.instructions;
    expect(
      typeof instructions === "object" &&
        instructions !== null &&
        !Array.isArray(instructions) &&
        "baseBranch" in instructions
        ? instructions.baseBranch
        : null
    ).toBe("main");
    const match = read(".test-env.example").match(/^BASE_BRANCH=(.+)$/m);
    expect(match?.[1]).toBe("main");
  });

  test("docs declare main as base branch", () => {
    expect(read("LLM-INTEGRATION.md")).toContain("Base branch: `main`");
    const sessions = readJsonObject(
      "docs/testing/web-folders-exploratory-sessions.json"
    );
    expect(sessions.branch).toBe("main");
  });
});
