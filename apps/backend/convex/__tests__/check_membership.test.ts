import { describe, expect, test } from "vitest";

import type { Doc } from "../_generated/dataModel";
import { isMemberInGoodStanding } from "../check_membership";

const baseMember = {
  _id: "k57b1c" as Doc<"organization_members">["_id"],
  _creationTime: Date.now(),
  userId: "k57b1a" as Doc<"users">["_id"],
  organizationId: "k57b1b" as Doc<"organizations">["_id"],
  role: "member" as const,
  isPrimary: false,
};

describe("isMemberInGoodStanding", () => {
  test("returns true for an active member", () => {
    const member = {
      ...baseMember,
      status: "active" as const,
    } as Doc<"organization_members">;

    expect(isMemberInGoodStanding(member)).toBe(true);
  });

  test("returns false for an inactive member", () => {
    const member = {
      ...baseMember,
      status: "inactive" as const,
    } as Doc<"organization_members">;

    expect(isMemberInGoodStanding(member)).toBe(false);
  });

  test("returns false for a suspended member", () => {
    const member = {
      ...baseMember,
      status: "suspended" as const,
    } as Doc<"organization_members">;

    expect(isMemberInGoodStanding(member)).toBe(false);
  });

  test("returns false for a pending member", () => {
    const member = {
      ...baseMember,
      status: "pending" as const,
    } as Doc<"organization_members">;

    expect(isMemberInGoodStanding(member)).toBe(false);
  });

  test("returns false for a blocked member", () => {
    const member = {
      ...baseMember,
      status: "blocked" as const,
    } as Doc<"organization_members">;

    expect(isMemberInGoodStanding(member)).toBe(false);
  });

  test("returns true for an active owner", () => {
    const member = {
      ...baseMember,
      role: "owner" as const,
      status: "active" as const,
    } as Doc<"organization_members">;

    expect(isMemberInGoodStanding(member)).toBe(true);
  });
});
