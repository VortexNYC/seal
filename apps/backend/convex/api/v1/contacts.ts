/**
 * @fileoverview Contact directory management for the public API.
 * CRUD operations for the workspace contact book.
 *
 * @module api/v1/contacts
 * @requires seal:contacts:read for GET, seal:contacts:write for POST/DELETE
 */
import { v } from "convex/values";

import { internalMutation, internalQuery } from "../../_generated/server";

/**
 * Format a timestamp as a human-readable relative label.
 *
 * @param timestampMs - Timestamp in milliseconds since epoch
 * @returns Human-readable label like "Just now", "5 minutes ago", "2 hours ago", etc.
 */
function formatUpdatedAtLabel(timestampMs: number): string {
  const now = Date.now();
  const diffMs = now - timestampMs;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  return new Date(timestampMs).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** API representation of a contact */
export interface ApiContact {
  /** Contact record ID */
  id: string;
  /** First name */
  first_name: string;
  /** Last name */
  last_name: string;
  /** Full name */
  full_name: string;
  /** Email address */
  email: string;
  /** Phone number */
  phone?: string;
  /** Company or organization */
  company?: string;
  /** Job title */
  title?: string;
  /** Contact status */
  status: "active" | "inactive" | "lead";
  /** Free-form notes */
  notes?: string;
  /** Tags for categorization */
  tags?: string[];
  /** ISO 8601 timestamp of last contact */
  last_contacted_at?: string;
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** ISO 8601 last update timestamp */
  updated_at: string;
  /** Human-readable relative update label */
  updated_at_label?: string;
}

/**
 * Internal query to list contacts in the workspace.
 *
 * @internal
 */
export const listContacts = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("lead"))),
    search: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ contacts: ApiContact[]; has_more: boolean; next_cursor?: string }> => {
    const limit = Math.min(args.limit ?? 20, 100);

    let raw;
    if (args.status) {
      raw = await ctx.db
        .query("contacts")
        .withIndex("by_org_status", (q) =>
          q.eq("organizationId", args.organizationId).eq("status", args.status!),
        )
        .collect();
    } else {
      raw = await ctx.db
        .query("contacts")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
        .collect();
    }

    // Client-side search filter
    const filtered = args.search
      ? raw.filter(
          (c) =>
            c.fullName.toLowerCase().includes(args.search!.toLowerCase()) ||
            c.email.toLowerCase().includes(args.search!.toLowerCase()),
        )
      : raw;

    // Cursor pagination
    let start = 0;
    if (args.cursor) {
      const idx = filtered.findIndex((c) => c._id === args.cursor);
      if (idx !== -1) start = idx + 1;
    }

    const page = filtered.slice(start, start + limit + 1);
    const has_more = page.length > limit;
    const items = has_more ? page.slice(0, limit) : page;
    const next_cursor = has_more ? items[items.length - 1]?._id : undefined;

    return {
      contacts: items.map((c) => ({
        id: c._id,
        first_name: c.firstName,
        last_name: c.lastName,
        full_name: c.fullName,
        email: c.email,
        phone: c.phone,
        company: c.company,
        title: c.title,
        status: c.status,
        notes: c.notes,
        tags: c.tags,
        last_contacted_at: c.lastContactedAt
          ? new Date(c.lastContactedAt).toISOString()
          : undefined,
        created_at: new Date(c.createdAt).toISOString(),
        updated_at: new Date(c.updatedAt).toISOString(),
        updated_at_label: formatUpdatedAtLabel(c.updatedAt),
      })),
      has_more,
      next_cursor,
    };
  },
});

/**
 * Internal query to get a single contact by ID.
 *
 * @internal
 */
export const getContact = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args): Promise<ApiContact | null> => {
    const c = await ctx.db.get(args.contactId);
    if (!c || c.organizationId !== args.organizationId) return null;

    return {
      id: c._id,
      first_name: c.firstName,
      last_name: c.lastName,
      full_name: c.fullName,
      email: c.email,
      phone: c.phone,
      company: c.company,
      title: c.title,
      status: c.status,
      notes: c.notes,
      tags: c.tags,
      last_contacted_at: c.lastContactedAt ? new Date(c.lastContactedAt).toISOString() : undefined,
      created_at: new Date(c.createdAt).toISOString(),
      updated_at: new Date(c.updatedAt).toISOString(),
      updated_at_label: formatUpdatedAtLabel(c.updatedAt),
    };
  },
});

/**
 * Internal mutation to create a new contact.
 *
 * @internal
 */
export const createContact = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    first_name: v.string(),
    last_name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    company: v.optional(v.string()),
    title: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"), v.literal("lead"))),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{ id: string }> => {
    const fullName = `${args.first_name} ${args.last_name}`.trim();
    const now = Date.now();

    const contactId = await ctx.db.insert("contacts", {
      organizationId: args.organizationId,
      firstName: args.first_name,
      lastName: args.last_name,
      fullName,
      email: args.email,
      phone: args.phone,
      company: args.company,
      title: args.title,
      status: args.status ?? "active",
      notes: args.notes,
      tags: args.tags,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    return { id: contactId };
  },
});

/**
 * Internal mutation to delete a contact.
 *
 * @internal
 */
export const deleteContact = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.organizationId !== args.organizationId) {
      throw new Error("Contact not found");
    }

    await ctx.db.delete(args.contactId);
    return { success: true };
  },
});
