import { describe, expect, test } from "vitest";

import { isReadOnlyRole } from "../rls";

describe("isReadOnlyRole", () => {
  test("returns true for viewer", () => {
    expect(isReadOnlyRole("viewer")).toBe(true);
  });

  test("returns true for guest", () => {
    expect(isReadOnlyRole("guest")).toBe(true);
  });

  test("returns false for owner", () => {
    expect(isReadOnlyRole("owner")).toBe(false);
  });

  test("returns false for admin", () => {
    expect(isReadOnlyRole("admin")).toBe(false);
  });

  test("returns false for unknown role", () => {
    expect(isReadOnlyRole("unknown")).toBe(false);
    expect(isReadOnlyRole("member")).toBe(false);
    expect(isReadOnlyRole("system")).toBe(false);
    expect(isReadOnlyRole("")).toBe(false);
  });
});
