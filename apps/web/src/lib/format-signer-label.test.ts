import { describe, test, expect } from "vitest";

import { formatSignerLabel } from "./format-signer-label";

describe("formatSignerLabel", () => {
  test("returns 'name (email)' when name is truthy", () => {
    expect(formatSignerLabel("Alice", "alice@example.com")).toBe(
      "Alice (alice@example.com)",
    );
  });

  test("returns just the email when name is not provided", () => {
    expect(formatSignerLabel("", "bob@example.com")).toBe("bob@example.com");
    expect(formatSignerLabel(null, "bob@example.com")).toBe("bob@example.com");
    expect(formatSignerLabel(undefined, "bob@example.com")).toBe(
      "bob@example.com",
    );
  });
});
