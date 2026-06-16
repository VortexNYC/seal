/**
 * Invitations table schema for Control Zero
 */

import { type Infer, v } from "convex/values";

export const organizationInvitationStatusTuple = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("expired"),
);
export type OrganizationInvitationStatus = Infer<typeof organizationInvitationStatusTuple>;
