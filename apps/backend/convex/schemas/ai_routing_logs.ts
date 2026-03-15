import { defineTable } from "convex/server";
import { v } from "convex/values";

export const aiRoutingLogsTable = defineTable({
  threadId: v.string(),
  /** Which tier actually ran: 1 (Flash-Lite), 2 (Flash), or 3 (Pro) */
  tier: v.number(),
  /** True if Tier 1 was attempted first but fell back to Tier 2 */
  wasFallback: v.boolean(),
  timestamp: v.number(),
}).index("by_thread", ["threadId"]);
