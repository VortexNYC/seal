import { type Infer, v } from "convex/values";

export const organizationRoleType = v.union(v.literal("system"), v.literal("custom"));
export type OrganizationRoleType = Infer<typeof organizationRoleType>;
