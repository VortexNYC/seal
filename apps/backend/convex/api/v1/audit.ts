/**
 * @fileoverview Organization-wide audit log for the public API.
 * Returns a paginated, filterable history of all events in the workspace.
 *
 * @module api/v1/audit
 * @requires seal:audit:read scope
 */
import { v } from "convex/values";

import { internalQuery } from "../../_generated/server";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present.",
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

/** API representation of an org-level audit log entry */
export interface ApiAuditLogEntry {
  /** Entry ID */
  id: string;
  /** The action that was performed */
  action: string;
  /** Who performed it — "user", "recipient", or "system" */
  actor_type: string;
  /** Actor display name */
  actor_name?: string;
  /** Actor email address */
  actor_email?: string;
  /** Type of resource affected */
  resource_type: string;
  /** ID of the affected resource */
  resource_id?: string;
  /** Document ID if the event is document-related */
  document_id?: string;
  /** IP address of the actor */
  ip_address?: string;
  /** Where the action originated — "web", "api", or "system" */
  source?: string;
  /** ISO 8601 timestamp */
  created_at: string;
}

/**
 * Internal query to list audit log entries for the organization.
 *
 * @internal
 */
export const listAuditLog = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    document_id: v.optional(v.id("documents")),
    action: v.optional(v.string()),
    created_after: v.optional(v.number()),
    created_before: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ entries: ApiAuditLogEntry[]; has_more: boolean; next_cursor?: string }> => {
    const limit = Math.min(args.limit ?? 20, 100);

    let query;

    if (args.document_id) {
      // Filter by document
      query = ctx.db
        .query("audit_logs")
        .withIndex("by_document_created", (q) =>
          q
            .eq("documentId", sealAssertPresent(args.document_id))
            .gte("createdAt", args.created_after ?? 0),
        );
    } else {
      // Org-wide filter
      query = ctx.db
        .query("audit_logs")
        .withIndex("by_organization_created", (q) =>
          q.eq("organizationId", args.organizationId).gte("createdAt", args.created_after ?? 0),
        );
    }

    // Apply upper date bound and action filter in-memory (Convex single-range index)
    const allEntries = await query.order("desc").collect();

    const filtered = allEntries.filter((e) => {
      if (args.created_before && e.createdAt > args.created_before) return false;
      if (args.action && e.action !== args.action) return false;
      return true;
    });

    // Manual cursor pagination
    let start = 0;
    if (args.cursor) {
      const idx = filtered.findIndex((e) => e._id === args.cursor);
      if (idx !== -1) start = idx + 1;
    }

    const page = filtered.slice(start, start + limit + 1);
    const has_more = page.length > limit;
    const items = has_more ? page.slice(0, limit) : page;
    const next_cursor = has_more ? items[items.length - 1]?._id : undefined;

    // Resolve actor names for user-type actors
    const entries: ApiAuditLogEntry[] = await Promise.all(
      items.map(async (entry) => {
        let actor_name: string | undefined;
        let actor_email: string | undefined;

        if (entry.actorType === "user" && entry.userId) {
          // Look up user by auth subject in our users table
          const user = await ctx.db
            .query("users")
            .withIndex("by_auth_subject", (q) =>
              q.eq("authSubject", sealAssertPresent(entry.userId)),
            )
            .first();
          if (user) {
            actor_name = user.name;
            actor_email = user.email;
          }
        } else if (entry.actorType === "recipient" && entry.actorId) {
          const recipient = await ctx.db.get(entry.actorId as Parameters<typeof ctx.db.get>[0]);
          if (recipient && "email" in recipient) {
            actor_email = recipient.email as string;
            actor_name = "name" in recipient ? (recipient.name as string) : undefined;
          }
        }

        return {
          id: entry._id,
          action: entry.action,
          actor_type: entry.actorType,
          actor_name,
          actor_email,
          resource_type: entry.resourceType,
          resource_id: entry.resourceId,
          document_id: entry.documentId,
          ip_address: entry.ipAddress,
          source: entry.metadata?.source,
          created_at: new Date(entry.createdAt).toISOString(),
        };
      }),
    );

    return { entries, has_more, next_cursor };
  },
});
