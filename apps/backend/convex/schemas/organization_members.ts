import { type Infer, v } from "convex/values";

import { userStatus } from "./users";

export const organizationMemberRoleTuple = v.union(
  v.literal("system"),
  v.literal("admin"),
  v.literal("owner"),
  v.literal("member"),
  v.literal("viewer"),
);
export type OrganizationMemberRole = Infer<typeof organizationMemberRoleTuple>;

export const organizationMemberStatus = userStatus;
export type OrganizationMemberStatus = Infer<typeof organizationMemberStatus>;
