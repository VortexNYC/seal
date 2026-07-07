import { ConvexError, v } from "convex/values";

import { adminMutation } from "../auth";

export const createLabel = adminMutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (!name) throw new ConvexError("Label name cannot be empty");

    const labelId = await ctx.db.insert("labels", {
      organizationId: ctx.auth.organization._id,
      name,
      color: args.color,
      createdBy: ctx.auth.user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { id: labelId };
  },
});

export const updateLabel = adminMutation({
  args: {
    labelId: v.id("labels"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const label = await ctx.db.get(args.labelId);
    if (!label || label.organizationId !== ctx.auth.organization._id) {
      throw new ConvexError("Label not found");
    }

    const updates: Partial<{ name: string; color: string | undefined; updatedAt: number }> = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new ConvexError("Label name cannot be empty");
      updates.name = name;
    }
    if (args.color !== undefined) {
      updates.color = args.color;
    }

    await ctx.db.patch(args.labelId, updates);
    return { success: true };
  },
});

export const deleteLabel = adminMutation({
  args: {
    labelId: v.id("labels"),
  },
  handler: async (ctx, args) => {
    const label = await ctx.db.get(args.labelId);
    if (!label || label.organizationId !== ctx.auth.organization._id) {
      throw new ConvexError("Label not found");
    }

    await ctx.db.delete(args.labelId);
    return { success: true };
  },
});
