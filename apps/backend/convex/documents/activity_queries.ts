/**
 * Document Activity Queries
 *
 * Queries for retrieving document activity events for the activity feed.
 * Combines document events with recipient events for a complete timeline.
 */

import { ConvexError, v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { authQuery } from "../auth";
import { ACCESS_ERRORS, checkDocumentAccess, getDocumentOrThrow } from "../auth/access_control";

type ActivityQueryDbCtx = Pick<QueryCtx, "db">;

/**
 * Activity event types that map to the frontend ActivityFeed component
 */
export type ActivityEventType =
  | "created"
  | "recipient_added"
  | "sent"
  | "viewed"
  | "signed"
  | "approved"
  | "declined"
  | "completed"
  | "cancelled"
  | "reminder_sent"
  | "shared"
  | "access_revoked";

/**
 * Validator for activity event types - used in query args
 */
const activityEventTypeValidator = v.union(
  v.literal("created"),
  v.literal("recipient_added"),
  v.literal("sent"),
  v.literal("viewed"),
  v.literal("signed"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("reminder_sent"),
  v.literal("shared"),
  v.literal("access_revoked"),
);

interface ActivityEvent {
  type: ActivityEventType;
  timestamp: number;
  description: string;
  actor?: string;
  actorId?: string; // User ID of the actor for filtering
}

interface PaginatedActivityResult {
  events: ActivityEvent[];
  total: number;
  hasMore: boolean;
}

interface OwnerActivityContext {
  ownerName: string;
  ownerId: string;
}

function addActivityEvent(events: ActivityEvent[], event: ActivityEvent): void {
  events.push(event);
}

function addDocumentEvents(
  events: ActivityEvent[],
  document: Doc<"documents">,
  owner: OwnerActivityContext,
  recipientCount: number,
): void {
  addActivityEvent(events, {
    type: "created",
    timestamp: document.createdAt,
    description: "Document created",
    actor: owner.ownerName,
    actorId: owner.ownerId,
  });

  if (document.sentAt) {
    addActivityEvent(events, {
      type: "sent",
      timestamp: document.sentAt,
      description: `Document sent to ${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}`,
      actor: owner.ownerName,
      actorId: owner.ownerId,
    });
  }

  if (document.completedAt) {
    addActivityEvent(events, {
      type: "completed",
      timestamp: document.completedAt,
      description: "All recipients have completed signing",
    });
  }

  if (document.cancelledAt) {
    addActivityEvent(events, {
      type: "cancelled",
      timestamp: document.cancelledAt,
      description: "Document was cancelled",
      actor: owner.ownerName,
      actorId: owner.ownerId,
    });
  }
}

function addRecipientStatusEvents(
  events: ActivityEvent[],
  recipientName: string,
  recipientActorId: string,
  timestamps: Partial<
    Record<Extract<ActivityEventType, "viewed" | "signed" | "approved" | "declined">, number>
  >,
): void {
  if (timestamps.viewed) {
    addActivityEvent(events, {
      type: "viewed",
      timestamp: timestamps.viewed,
      description: `${recipientName} viewed the document`,
      actor: recipientName,
      actorId: recipientActorId,
    });
  }

  if (timestamps.signed) {
    addActivityEvent(events, {
      type: "signed",
      timestamp: timestamps.signed,
      description: `${recipientName} signed the document`,
      actor: recipientName,
      actorId: recipientActorId,
    });
  }

  if (timestamps.approved) {
    addActivityEvent(events, {
      type: "approved",
      timestamp: timestamps.approved,
      description: `${recipientName} approved the document`,
      actor: recipientName,
      actorId: recipientActorId,
    });
  }

  if (timestamps.declined) {
    addActivityEvent(events, {
      type: "declined",
      timestamp: timestamps.declined,
      description: `${recipientName} declined to sign`,
      actor: recipientName,
      actorId: recipientActorId,
    });
  }
}

function addRecipientEvents(
  events: ActivityEvent[],
  recipients: Doc<"document_recipients">[],
  owner: OwnerActivityContext,
): void {
  for (const recipient of recipients) {
    const recipientName = recipient.name || recipient.email;
    const recipientActorId = `recipient:${recipient.email}`;

    addActivityEvent(events, {
      type: "recipient_added",
      timestamp: recipient.createdAt,
      description: `${recipientName} added as ${recipient.role}`,
      actor: owner.ownerName,
      actorId: owner.ownerId,
    });

    addRecipientStatusEvents(events, recipientName, recipientActorId, {
      viewed: recipient.viewedAt,
      signed: recipient.signedAt,
      approved: recipient.approvedAt,
      declined: recipient.declinedAt,
    });
  }
}

async function addReminderEvents(
  ctx: ActivityQueryDbCtx,
  events: ActivityEvent[],
  documentId: Doc<"documents">["_id"],
  recipients: Doc<"document_recipients">[],
  owner: OwnerActivityContext,
): Promise<void> {
  const reminders = await ctx.db
    .query("document_reminders")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .filter((q) => q.eq(q.field("status"), "sent"))
    .collect();

  for (const reminder of reminders) {
    if (!reminder.sentAt || !reminder.recipientId) {
      continue;
    }

    const recipient = recipients.find((item) => item._id === reminder.recipientId);
    const recipientName = recipient?.name || recipient?.email || "Recipient";
    addActivityEvent(events, {
      type: "reminder_sent",
      timestamp: reminder.sentAt,
      description: `Reminder sent to ${recipientName}`,
      actor: owner.ownerName,
      actorId: owner.ownerId,
    });
  }
}

async function addAccessEvents(
  ctx: ActivityQueryDbCtx,
  events: ActivityEvent[],
  documentId: Doc<"documents">["_id"],
  owner: OwnerActivityContext,
): Promise<void> {
  const accessRecords = await ctx.db
    .query("document_access")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .collect();

  for (const access of accessRecords) {
    const accessUser = await ctx.db.get(access.userId);
    const grantedByUser = await ctx.db.get(access.grantedBy);
    const accessUserName = accessUser?.name || accessUser?.email || "User";
    const grantedByName = grantedByUser?.name || grantedByUser?.email || "Someone";

    addActivityEvent(events, {
      type: "shared",
      timestamp: access.grantedAt,
      description: `${accessUserName} was given ${access.permissionLevel} access`,
      actor: grantedByName,
      actorId: access.grantedBy.toString(),
    });

    if (access.revokedAt) {
      addActivityEvent(events, {
        type: "access_revoked",
        timestamp: access.revokedAt,
        description: `${accessUserName}'s access was revoked`,
        actor: owner.ownerName,
        actorId: owner.ownerId,
      });
    }
  }
}

function applyActivityFilters(
  events: ActivityEvent[],
  actorId?: string,
  eventTypes?: ActivityEventType[],
): ActivityEvent[] {
  let filteredEvents = events;

  if (actorId) {
    filteredEvents = filteredEvents.filter((event) => event.actorId === actorId);
  }

  if (eventTypes && eventTypes.length > 0) {
    const eventTypeSet = new Set(eventTypes);
    filteredEvents = filteredEvents.filter((event) => eventTypeSet.has(event.type));
  }

  return filteredEvents;
}

/**
 * Get activity events for a document
 * Combines audit logs and recipient activity into a unified timeline
 * Supports filtering by actor (member) and event type, with pagination
 */
export const getDocumentActivity = authQuery({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    actorId: v.optional(v.id("users")), // Filter by specific member
    eventTypes: v.optional(v.array(activityEventTypeValidator)), // Filter by event types
  },
  handler: async (ctx, args): Promise<PaginatedActivityResult> => {
    const userId = ctx.auth.user._id;
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;

    const document = await getDocumentOrThrow(ctx, args.documentId);

    const accessResult = await checkDocumentAccess(ctx, userId, document);
    if (!accessResult.hasAccess) {
      throw new ConvexError(ACCESS_ERRORS.NO_ACCESS);
    }

    const owner = await ctx.db.get(document.ownerId);
    const ownerActivity = {
      ownerName: owner?.name || owner?.email || "Document owner",
      ownerId: document.ownerId.toString(),
    };
    const events: ActivityEvent[] = [];

    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    addDocumentEvents(events, document, ownerActivity, recipients.length);
    addRecipientEvents(events, recipients, ownerActivity);
    await addReminderEvents(ctx, events, args.documentId, recipients, ownerActivity);
    await addAccessEvents(ctx, events, args.documentId, ownerActivity);

    const filteredEvents = applyActivityFilters(
      events,
      args.actorId?.toString(),
      args.eventTypes ?? undefined,
    );

    filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

    const total = filteredEvents.length;
    const paginatedEvents = filteredEvents.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      events: paginatedEvents,
      total,
      hasMore,
    };
  },
});

/**
 * Get list of unique actors for a document (for the filter dropdown)
 */
export const getDocumentActors = authQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<Array<{ id: string; name: string; type: "owner" | "member" }>> => {
    const userId = ctx.auth.user._id;

    const document = await getDocumentOrThrow(ctx, args.documentId);

    const accessResult = await checkDocumentAccess(ctx, userId, document);
    if (!accessResult.hasAccess) {
      throw new ConvexError(ACCESS_ERRORS.NO_ACCESS);
    }

    // Build list of unique actors
    const actorsMap = new Map<string, { id: string; name: string; type: "owner" | "member" }>();

    // Add owner
    const owner = await ctx.db.get(document.ownerId);
    if (owner) {
      actorsMap.set(document.ownerId.toString(), {
        id: document.ownerId.toString(),
        name: owner.name || owner.email || "Document owner",
        type: "owner",
      });
    }

    // Add users who have been granted access
    const accessRecords = await ctx.db
      .query("document_access")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const access of accessRecords) {
      if (!actorsMap.has(access.userId.toString())) {
        const user = await ctx.db.get(access.userId);
        if (user) {
          actorsMap.set(access.userId.toString(), {
            id: access.userId.toString(),
            name: user.name || user.email || "Unknown",
            type: "member",
          });
        }
      }
      // Also add the granter
      if (!actorsMap.has(access.grantedBy.toString())) {
        const granter = await ctx.db.get(access.grantedBy);
        if (granter) {
          actorsMap.set(access.grantedBy.toString(), {
            id: access.grantedBy.toString(),
            name: granter.name || granter.email || "Unknown",
            type: "member",
          });
        }
      }
    }

    return Array.from(actorsMap.values()).sort((a, b) => {
      // Owner first
      if (a.type === "owner") return -1;
      if (b.type === "owner") return 1;
      return a.name.localeCompare(b.name);
    });
  },
});
