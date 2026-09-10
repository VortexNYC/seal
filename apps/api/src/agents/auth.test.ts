import { describe, expect, it } from "vitest";

import type { SessionUser } from "../platform/session.js";
import { authorizeThreadAccess, type ThreadOwnership } from "./auth.js";

function makeUser(userId: string, activeOrganizationId?: string): SessionUser {
  return {
    user: { id: userId, name: "Test User", email: "test@example.com" },
    session:
      activeOrganizationId === undefined ? undefined : { activeOrganizationId },
  };
}

describe("authorizeThreadAccess", () => {
  it("rejects an undefined thread", () => {
    expect(authorizeThreadAccess(makeUser("user_1", "org_1"), undefined)).toBe(
      false
    );
  });

  it("rejects a missing active organization", () => {
    const thread: ThreadOwnership = {
      organizationId: "org_1",
      userId: "user_1",
    };
    expect(authorizeThreadAccess(makeUser("user_1"), thread)).toBe(false);
  });

  it("rejects a thread from another organization", () => {
    const thread: ThreadOwnership = {
      organizationId: "org_2",
      userId: "user_1",
    };
    expect(authorizeThreadAccess(makeUser("user_1", "org_1"), thread)).toBe(
      false
    );
  });

  it("rejects a thread owned by another user", () => {
    const thread: ThreadOwnership = {
      organizationId: "org_1",
      userId: "user_2",
    };
    expect(authorizeThreadAccess(makeUser("user_1", "org_1"), thread)).toBe(
      false
    );
  });

  it("accepts a thread owned by the user in their active organization", () => {
    const thread: ThreadOwnership = {
      organizationId: "org_1",
      userId: "user_1",
    };
    expect(authorizeThreadAccess(makeUser("user_1", "org_1"), thread)).toBe(
      true
    );
  });
});
