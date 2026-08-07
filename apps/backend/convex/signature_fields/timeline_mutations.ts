import { v } from "convex/values";

import { mutation, query } from "../_generated/server";
import {
  getFieldTimelineStatus,
  redoFieldChange,
  undoFieldChange,
} from "./timeline_helpers";

export const undoFields = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const document = await ctx.db.get("documents", args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const workflowStatus = document.workflowStatus ?? "draft";
    if (workflowStatus !== "draft") {
      throw new Error("Can only undo field changes on draft documents");
    }

    return await undoFieldChange(ctx, args.documentId);
  },
});

export const redoFields = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const document = await ctx.db.get("documents", args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const workflowStatus = document.workflowStatus ?? "draft";
    if (workflowStatus !== "draft") {
      throw new Error("Can only redo field changes on draft documents");
    }

    return await redoFieldChange(ctx, args.documentId);
  },
});

export const fieldTimelineStatus = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await getFieldTimelineStatus(ctx, args.documentId);
  },
});
