/**
 * @fileoverview Contact directory management for the public API.
 * CRUD operations for the workspace contact book.
 *
 * @module api/v1/contacts
 * @requires seal:contacts:read for GET, seal:contacts:write for POST/DELETE
 */
import { v } from "convex/values";

import { internalMutation, internalQuery } from "../../_generated/server";

/** Sortable contact fields */
type ContactSortField = "first_name" | "last_name" | "email" | "status" | "company" | "created_at" | "updated_at";
/** Sort direction */
type SortOrder = "asc" | "desc";

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
}

function compareContacts(a: ApiContact, b: ApiContact, sortBy: ContactSortField, direction: 1 | -1): number {
  let cmp = 0;
  switch (sortBy) {
    case "first_name":
      cmp = a.first_name.localeCompare(b.first_name);
      break;
    case "last_name":
      cmp = a.last_name.localeCompare(b.last_name);
      break;
    case "email":
      cmp = a.email.localeCompare(b.email);
      break;
    case "status":
      cmp = a.status.localeCompare(b.status);
      break;
    case "company":
      cmp = (a.company ?? "").localeCompare(b.company ?? "");
      break;
    case "created_at":
      cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      break;
    case "updated_at":
      cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      break;
  }
  if (cmp !== 0) return cmp * direction;
  return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * direction;
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
    sort_by: v.optional(
      v.union(
        v.literal("first_name"),
        v.literal("last_name"),
        v.literal("email"),
        v.literal("status"),
        v.literal("company"),
        v.literal("created_at"),
        v.literal("updated_at"),
      ),
    ),
    sort_order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ contacts: ApiContact[]; has_more: boolean; next_cursor?: string }> => {
    const limit = Math.min(args.limit ?? 20, 100);
    const sortBy: ContactSortField = args.sort_by ?? "created_at";
    const sortOrder: SortOrder = args.sort_order ?? "desc";
    const searchTerm = args.search?.trim().toLowerCase();

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
            c.fullName.toLowerCase().includes(searchTerm!) ||
            c.email.toLowerCase().includes(searchTerm!),
        )
      : raw;

    const mapped = filtered.map((c) => ({
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
    }));

    const direction = sortOrder === "desc" ? -1 : 1;
    mapped.sort((a, b) => compareContacts(a, b, sortBy, direction as 1 | -1));

    // Cursor pagination
    let start = 0;
    if (args.cursor) {
      const idx = mapped.findIndex((c) => c.id === args.cursor);
      if (idx !== -1) start = idx + 1;
    }

    const page = mapped.slice(start, start + limit + 1);
    const has_more = page.length > limit;
    const items = has_more ? page.slice(0, limit) : page;
    const next_cursor = has_more ? items[items.length - 1]?.id : undefined;

    return {
      contacts: items,
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
