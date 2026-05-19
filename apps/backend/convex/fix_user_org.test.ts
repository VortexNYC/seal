import { describe, expect, test } from "vitest";

import { isOrphanedUser } from "./fix_user_org";

describe("isOrphanedUser", () => {
  test("returns true for an empty list", () => {
    expect(isOrphanedUser("u1", [])).toBe(true);
  });

  test("returns true when there are zero matching memberships", () => {
    expect(
      isOrphanedUser("u1", [
        { userId: "u2", orgId: "o1" },
        { userId: "u3", orgId: "o2" },
      ]),
    ).toBe(true);
  });

  test("returns false when there is one matching membership", () => {
    expect(
      isOrphanedUser("u1", [
        { userId: "u1", orgId: "o1" },
        { userId: "u2", orgId: "o2" },
      ]),
    ).toBe(false);
  });

  test("returns false when there are multiple matching memberships", () => {
    expect(
      isOrphanedUser("u1", [
        { userId: "u1", orgId: "o1" },
        { userId: "u1", orgId: "o2" },
        { userId: "u2", orgId: "o3" },
      ]),
    ).toBe(false);
  });
});
