import { describe, expect, test } from "vitest";

import { summarizeExportScope } from "./user_data_export";

describe("summarizeExportScope", () => {
  test("multi-part", () => {
    expect(summarizeExportScope(["profile", "documents"])).toBe(
      "Export includes: profile, documents",
    );
  });

  test("single", () => {
    expect(summarizeExportScope(["profile"])).toBe("Export includes: profile");
  });

  test("empty", () => {
    expect(summarizeExportScope([])).toBe("Export includes: nothing");
  });
});