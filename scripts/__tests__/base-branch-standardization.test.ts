import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("SEA-586 base branch standardization", () => {
  describe("GitHub workflow triggers", () => {
    test("ci.yml targets only main", () => {
      const content = read(".github/workflows/ci.yml");
      expect(content).toContain("branches: [main]");
      expect(content).not.toContain("branches: [main, staging]");
      expect(content).not.toContain("branches: [staging]");
    });

    test("guard.yml targets only main", () => {
      const content = read(".github/workflows/guard.yml");
      expect(content).toContain("branches: [main]");
      expect(content).not.toContain("branches: [main, staging]");
      expect(content).not.toContain("branches: [staging]");
    });

    test("vortex-quality.yml targets only main", () => {
      const content = read(".github/workflows/vortex-quality.yml");
      expect(content).toContain("branches: [main]");
      expect(content).not.toContain("branches: [main, staging]");
      expect(content).not.toContain("branches: [staging]");
    });
  });

  describe("Project configuration", () => {
    test("vortex.project.json declares baseBranch as main", () => {
      const content = read("vortex.project.json");
      const parsed = JSON.parse(content);
      expect(parsed.instructions.baseBranch).toBe("main");
    });

    test(".test-env.example declares BASE_BRANCH as main", () => {
      const content = read(".test-env.example");
      const match = content.match(/^BASE_BRANCH=(.+)$/m);
      expect(match).toBeTruthy();
      expect(match![1]).toBe("main");
    });
  });

  describe("Documentation", () => {
    test(".claude/CLAUDE.md references main as base branch", () => {
      const content = read(".claude/CLAUDE.md");
      expect(content).toContain("Branch from `main` and PR back to `main`.");
      expect(content).toContain("Base branch: `main`");
      expect(content).not.toMatch(/Base branch: `staging`/);
      expect(content).not.toMatch(/Branch from `staging`/);
    });

    test("LLM-INTEGRATION.md references main as base branch", () => {
      const content = read("LLM-INTEGRATION.md");
      expect(content).toContain("Base branch: `main`");
      expect(content).not.toMatch(/Base branch: `staging`/);
    });

    test("web-folders-exploratory-sessions.json uses main branch", () => {
      const content = read("docs/testing/web-folders-exploratory-sessions.json");
      const parsed = JSON.parse(content);
      expect(parsed.branch).toBe("main");
    });
  });

  describe("Edge case: no base-branch revert references remain", () => {
    test("none of the touched files contain a raw 'baseBranch': 'staging' or similar", () => {
      const files = [
        ".github/workflows/ci.yml",
        ".github/workflows/guard.yml",
        ".github/workflows/vortex-quality.yml",
        ".test-env.example",
        ".claude/CLAUDE.md",
        "LLM-INTEGRATION.md",
        "docs/testing/web-folders-exploratory-sessions.json",
        "vortex.project.json",
      ];

      for (const f of files) {
        const content = read(f);
        expect(content).not.toContain('"baseBranch": "staging"');
        expect(content).not.toContain("baseBranch: staging");
        expect(content).not.toContain('"branch": "staging"');
        expect(content).not.toContain("branches: [staging]");
        expect(content).not.toContain("branches: [main, staging]");
      }
    });
  });
});
