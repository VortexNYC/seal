/**
 * @fileoverview Organization-wide audit log for the public API.
 * Returns a paginated, filterable history of all events in the workspace.
 *
 * @module api/v1/audit
 * @requires seal:audit:read scope
 */
import { v } from "convex/values";

import type { Doc } from "../../_generated/dataModel";
import { internalQuery } from "../../_generated/server";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
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
    args
  ): Promise<{
    entries: ApiAuditLogEntry[];
    has_more: boolean;
    next_cursor?: string;
  }> => {
    const limit = args.limit ?? 20;

    // When post-filters are active, fetch more to ensure we can fill the page
    const hasFilters = !!(args.action || args.created_before);
    const fetchLimit = hasFilters ? Math.min(limit * 5, 500) : limit + 1;

    let cursorCreationTime: number | undefined;
    if (args.cursor) {
      const cursorId = ctx.db.normalizeId("audit_logs", args.cursor);
      if (cursorId) {
        const cursorDoc = await ctx.db.get("audit_logs", cursorId);
        if (cursorDoc) {
          cursorCreationTime = cursorDoc._creationTime;
        }
      }
    }

    const baseQuery = args.document_id
      ? ctx.db
          .query("audit_logs")
          .withIndex("by_document_created", (q) =>
            q
              .eq("documentId", sealAssertPresent(args.document_id))
              .gte("createdAt", args.created_after ?? 0)
          )
          .order("desc")
      : ctx.db
          .query("audit_logs")
          .withIndex("by_organization_created", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .gte("createdAt", args.created_after ?? 0)
          )
          .order("desc");

    const filtered: Doc<"audit_logs">[] = [];
    for await (const entry of baseQuery) {
      if (
        cursorCreationTime !== undefined &&
        entry._creationTime >= cursorCreationTime
      ) {
        continue;
      }
      if (args.created_before && entry.createdAt > args.created_before) {
        continue;
      }
      if (args.action && entry.action !== args.action) {
        continue;
      }
      filtered.push(entry);
      if (filtered.length >= fetchLimit) {
        break;
      }
    }

    const has_more = filtered.length > limit;
    const items = has_more ? filtered.slice(0, limit) : filtered;
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
              q.eq("authSubject", sealAssertPresent(entry.userId))
            )
            .first();
          if (user) {
            actor_name = user.name;
            actor_email = user.email;
          }
        } else if (entry.actorType === "recipient") {
          const recipientId =
            entry.recipientId ??
            (entry.actorId
              ? ctx.db.normalizeId("document_recipients", entry.actorId)
              : null);
          if (recipientId) {
            const recipient = await ctx.db.get(
              "document_recipients",
              recipientId
            );
            if (recipient) {
              actor_email = recipient.email;
              actor_name = recipient.name;
            }
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
      })
    );

    return { entries, has_more, next_cursor };
  },
});
