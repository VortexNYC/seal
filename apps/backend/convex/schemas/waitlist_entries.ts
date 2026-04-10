import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const waitlistEntryStatusTuple = v.union(
  v.literal("pending"),
  v.literal("invited"),
  v.literal("completed"),
  v.literal("rejected"),
);
export type WaitlistEntryStatus = Infer<typeof waitlistEntryStatusTuple>;

export const waitlistEntriesTable = defineTable({
  clerkId: v.string(),
  email: v.string(),
  status: waitlistEntryStatusTuple,
  isLocked: v.boolean(),
  invitationUrl: v.optional(v.string()),
  invitationStatus: v.optional(v.string()),
  invitationCreatedAt: v.optional(v.number()),
  invitationUpdatedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  invitedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  rejectedAt: v.optional(v.number()),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_email", ["email"])
  .index("by_status", ["status"])
  .index("by_status_updated", ["status", "updatedAt"]);
