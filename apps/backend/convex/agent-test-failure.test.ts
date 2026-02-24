import { describe, it, expect } from "vitest";

describe("intentional-failure", () => {
  it("should fail so the agent fixes it", () => {
    // Bug: wrong expected value
    expect(1 + 1).toBe(3);
  });
});
