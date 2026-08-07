/**
 * Contact queries
 *
 * Query functions for the Contacts/CRM module.
 */

import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { permissionQuery } from "../auth";
import { contactStatusValidator } from "../schemas/contacts";

/**
 * List all contacts for the current organization.
 * Optionally filter by status.
 * Requires contacts:view permission.
 */
export const list = permissionQuery("contacts:view")({
  args: {
    status: v.optional(contactStatusValidator),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const contacts: Doc<"contacts">[] = [];

    if (args.status) {
      const status = args.status;
      for await (const contact of ctx.db
        .query("contacts")
        .withIndex("by_org_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", status)
        )
        .order("desc")) {
        contacts.push(contact);
      }
      return contacts;
    }

    for await (const contact of ctx.db
      .query("contacts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId)
      )
      .order("desc")) {
      contacts.push(contact);
    }
    return contacts;
  },
});

/**
 * Get a single contact by ID.
 * Verifies the contact belongs to the current organization.
 * Requires contacts:view permission.
 */
export const getById = permissionQuery("contacts:view")({
  args: {
    id: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    const contact = await ctx.db.get("contacts", args.id);

    if (!contact) {
      throw new ConvexError("Contact not found");
    }

    if (contact.organizationId !== organizationId) {
      throw new ConvexError("Contact not found");
    }

    return contact;
  },
});

/**
 * Full-text search contacts by name.
 * Uses the search_contacts search index.
 * Requires contacts:view permission.
 */
export const search = permissionQuery("contacts:view")({
  args: {
    query: v.string(),
    status: v.optional(contactStatusValidator),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    const searchQuery = ctx.db
      .query("contacts")
      .withSearchIndex("search_contacts", (q) => {
        let sq = q
          .search("fullName", args.query)
          .eq("organizationId", organizationId);

        if (args.status) {
          sq = sq.eq("status", args.status);
        }

        return sq;
      });

    return await searchQuery.take(50);
  },
});

/**
 * Look up a contact by email within the current organization.
 * Returns the contact or null (does not throw).
 * Useful for duplicate detection.
 * Requires contacts:view permission.
 */
export const getByEmail = permissionQuery("contacts:view")({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    const contact = await ctx.db
      .query("contacts")
      .withIndex("by_org_email", (q) =>
        q.eq("organizationId", organizationId).eq("email", args.email)
      )
      .first();

    return contact;
  },
});

/**
 * Suggest contacts for recipient auto-fill.
 * Searches by name (full-text) and email prefix.
 * Returns up to 5 matches with basic info.
 * Requires contacts:view permission.
 */
export const suggestForRecipient = permissionQuery("contacts:view")({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const orgId = ctx.auth.organization._id;

    if (!args.searchTerm || args.searchTerm.trim().length < 2) {
      return [];
    }

    const term = args.searchTerm.trim();

    // Search by name using full-text search index (scoped to org)
    const results = await ctx.db
      .query("contacts")
      .withSearchIndex("search_contacts", (q) =>
        q.search("fullName", term).eq("organizationId", orgId)
      )
      .take(5);

    return results.map((c) => ({
      _id: c._id,
      fullName: c.fullName,
      email: c.email,
      company: c.company,
    }));
  },
});

/**
 * Get documents related to a contact by email.
 * Finds document_recipients matching the email, then fetches each document.
 * Only returns documents belonging to the current organization.
 * Requires contacts:view permission.
 */
export const getRelatedDocuments = permissionQuery("contacts:view")({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const orgId = ctx.auth.organization._id;

    // Find recipients with this email
    const recipients: Doc<"document_recipients">[] = [];
    for await (const recipient of ctx.db
      .query("document_recipients")
      .withIndex("by_email", (q) => q.eq("email", args.email))) {
      recipients.push(recipient);
    }

    // Get unique document IDs and fetch documents
    const documentIds = [...new Set(recipients.map((r) => r.documentId))];
    const documents = await Promise.all(
      documentIds.map(async (docId) => {
        const doc = await ctx.db.get("documents", docId);
        if (!doc || doc.organizationId !== orgId) return null;
        const recipient = recipients.find((r) => r.documentId === docId);
        return {
          _id: doc._id,
          name: doc.name,
          workflowStatus: doc.workflowStatus ?? ("draft" as const),
          role: recipient?.role ?? ("signer" as const),
          createdAt: doc.createdAt,
        };
      })
    );

    return documents.filter((d): d is NonNullable<typeof d> => d !== null);
  },
});
