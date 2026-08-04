/**
 * Contact mutations
 *
 * Mutation functions for the Contacts/CRM module.
 */

import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { permissionMutation } from "../auth";
import { contactStatusValidator } from "../schemas/contacts";

function buildContactUpdates(
  contact: Doc<"contacts">,
  args: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    company?: string;
    title?: string;
    status?: Doc<"contacts">["status"];
    notes?: string;
    tags?: string[];
    lastContactedAt?: number;
  }
): Record<string, string | number | string[] | undefined> {
  const updates: Record<string, string | number | string[] | undefined> = {
    updatedAt: Date.now(),
  };

  if (args.firstName !== undefined) updates.firstName = args.firstName;
  if (args.lastName !== undefined) updates.lastName = args.lastName;
  if (args.email !== undefined) updates.email = args.email.toLowerCase().trim();
  if (args.phone !== undefined) updates.phone = args.phone;
  if (args.company !== undefined) updates.company = args.company;
  if (args.title !== undefined) updates.title = args.title;
  if (args.status !== undefined) updates.status = args.status;
  if (args.notes !== undefined) updates.notes = args.notes;
  if (args.tags !== undefined) updates.tags = args.tags;
  if (args.lastContactedAt !== undefined)
    updates.lastContactedAt = args.lastContactedAt;

  if (args.firstName !== undefined || args.lastName !== undefined) {
    const firstName = args.firstName ?? contact.firstName;
    const lastName = args.lastName ?? contact.lastName;
    updates.fullName = `${firstName} ${lastName}`.trim();
  }

  return updates;
}

/**
 * Create a new contact.
 * Checks for duplicate emails within the organization.
 * Requires contacts:create permission.
 */
export const create = permissionMutation("contacts:create")({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    title: v.optional(v.string()),
    status: v.optional(contactStatusValidator),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const userId = ctx.auth.user._id;
    const now = Date.now();

    const fullName = `${args.firstName} ${args.lastName}`.trim();
    const normalizedEmail = args.email.toLowerCase().trim();

    // Check for duplicate email within org
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_org_email", (q) =>
        q.eq("organizationId", organizationId).eq("email", normalizedEmail)
      )
      .first();

    const isDuplicate = existing !== null;

    const contactId = await ctx.db.insert("contacts", {
      organizationId,
      firstName: args.firstName,
      lastName: args.lastName,
      fullName,
      email: normalizedEmail,
      phone: args.phone,
      company: args.company,
      title: args.title,
      status: args.status ?? "active",
      notes: args.notes,
      tags: args.tags,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    return { _id: contactId, isDuplicate };
  },
});

/**
 * Update an existing contact.
 * Recomputes fullName if firstName or lastName changes.
 * Requires contacts:edit permission.
 */
export const update = permissionMutation("contacts:edit")({
  args: {
    id: v.id("contacts"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    title: v.optional(v.string()),
    status: v.optional(contactStatusValidator),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    lastContactedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    const contact = await ctx.db.get(args.id);

    if (!contact) {
      throw new ConvexError("Contact not found");
    }

    if (contact.organizationId !== organizationId) {
      throw new ConvexError("Contact not found");
    }

    const updates = buildContactUpdates(contact, args);

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

/**
 * Delete a contact (hard delete).
 * Requires contacts:delete permission.
 */
export const remove = permissionMutation("contacts:delete")({
  args: {
    id: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    const contact = await ctx.db.get(args.id);

    if (!contact) {
      throw new ConvexError("Contact not found");
    }

    if (contact.organizationId !== organizationId) {
      throw new ConvexError("Contact not found");
    }

    await ctx.db.delete(args.id);

    return args.id;
  },
});

/**
 * Bulk delete contacts.
 * Returns per-item success/error results.
 * Requires contacts:delete permission.
 */
export const bulkDelete = permissionMutation("contacts:delete")({
  args: {
    ids: v.array(v.id("contacts")),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of args.ids) {
      const contact = await ctx.db.get(id);

      if (!contact) {
        results.push({ id, success: false, error: "Contact not found" });
        continue;
      }

      if (contact.organizationId !== organizationId) {
        results.push({ id, success: false, error: "Contact not found" });
        continue;
      }

      await ctx.db.delete(id);
      results.push({ id, success: true });
    }

    return results;
  },
});
