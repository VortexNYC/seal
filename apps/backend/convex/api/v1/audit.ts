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
    const limit = args.limit ?? 20;

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

    // Apply cursor if provided (use _creationTime for index-based pagination)
    if (args.cursor) {
      const cursorDoc = await ctx.db.get(args.cursor as Parameters<typeof ctx.db.get>[0]);
      if (cursorDoc) {
        query = query.filter((q) => q.lt(q.field("_creationTime"), cursorDoc._creationTime));
      }
    }

    // Narrow results at the Convex level before transfer
    if (args.created_before) {
      query = query.filter((q) => q.lte(q.field("createdAt"), args.created_before as number));
    }
    if (args.action) {
      query = query.filter((q) => q.eq(q.field("action"), args.action));
    }

    const allEntries = await query.order("desc").take(limit + 1);

    const has_more = allEntries.length > limit;
    const items = has_more ? allEntries.slice(0, limit) : allEntries;
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
