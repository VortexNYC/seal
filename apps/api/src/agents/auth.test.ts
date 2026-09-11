import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import { aiThreads, member, organization, user } from "../global/schema.js";
import { authorizeThreadAccess, type ThreadOwnership } from "./auth.js";

beforeEach(async () => {
  const db = createD1(env.D1);
  await db.delete(aiThreads);
  await db.delete(member);
  await db.delete(user);
  await db.delete(organization);

  await db.insert(organization).values({
    id: "org_1",
    name: "Test Org",
    slug: "test-org",
  });
  await db.insert(organization).values({
    id: "org_2",
    name: "Other Org",
    slug: "other-org",
  });
  await db.insert(user).values({
    id: "user_1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: "org_1",
    userId: "user_1",
    role: "owner",
    createdAt: new Date(),
  });
});

describe("authorizeThreadAccess", () => {
  it("rejects an undefined thread", () => {
    expect(authorizeThreadAccess("user_1", "org_1", undefined)).toBe(false);
  });

  it("rejects a thread from another organization", () => {
    const thread: ThreadOwnership = {
      organizationId: "org_2",
      userId: "user_1",
    };
    expect(authorizeThreadAccess("user_1", "org_1", thread)).toBe(false);
  });

  it("rejects a thread owned by another user", () => {
    const thread: ThreadOwnership = {
      organizationId: "org_1",
      userId: "user_2",
    };
    expect(authorizeThreadAccess("user_1", "org_1", thread)).toBe(false);
  });

  it("accepts a thread owned by the user in the organization", () => {
    const thread: ThreadOwnership = {
      organizationId: "org_1",
      userId: "user_1",
    };
    expect(authorizeThreadAccess("user_1", "org_1", thread)).toBe(true);
  });
});
