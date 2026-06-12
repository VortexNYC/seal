/**
 * Audit Log Mutations
 *
 * Exposes audit-log writing as internal Convex mutations so that other
 * server-side code (HTTP actions, webhooks, other modules' mutations)
 * can log audit events through the Convex mutation API.
 *
 * These wrap the existing helpers from ./helpers and are callable via
 * ctx.runMutation(internal.audit_logs.mutations.*, args).
 */

import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import type { AuditAction, AuditResourceType } from "../schemas/audit_logs";
import { auditActionTuple, auditResourceTypeTuple } from "../schemas/audit_logs";
import { logAction, logDocumentAction } from "./helpers";

export const logAuditEvent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.optional(v.string()),
    actorType: v.union(v.literal("user"), v.literal("recipient"), v.literal("system")),
    actorId: v.optional(v.string()),
    action: auditActionTuple,
    resourceType: auditResourceTypeTuple,
    resourceId: v.optional(v.string()),
    documentId: v.optional(v.id("documents")),
    recipientId: v.optional(v.id("document_recipients")),
    oldValues: v.optional(v.any()),
    newValues: v.optional(v.any()),
    metadata: v.optional(
      v.object({
        description: v.optional(v.string()),
        source: v.optional(v.string()),
        sessionId: v.optional(v.string()),
      }),
    ),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"audit_logs">> => {
    return await logAction(ctx, {
      organizationId: args.organizationId,
      userId: args.userId,
      actorType: args.actorType,
      actorId: args.actorId,
      action: args.action as AuditAction,
      resourceType: args.resourceType as AuditResourceType,
      resourceId: args.resourceId,
      documentId: args.documentId,
      recipientId: args.recipientId,
      oldValues: args.oldValues,
      newValues: args.newValues,
      metadata: args.metadata,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });
  },
});

export const logDocumentEvent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.string(),
    action: auditActionTuple,
    documentId: v.id("documents"),
    oldValues: v.optional(v.any()),
    newValues: v.optional(v.any()),
    description: v.optional(v.string()),
    ipAddress: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"audit_logs">> => {
    return await logDocumentAction(ctx, {
      organizationId: args.organizationId,
      userId: args.userId,
      action: args.action as AuditAction,
      documentId: args.documentId,
      oldValues: args.oldValues,
      newValues: args.newValues,
      description: args.description,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });
  },
});

const securityAuditActionTuple = v.union(
  v.literal("user.login"),
  v.literal("user.logout"),
  v.literal("user.updated"),
  v.literal("organization.created"),
  v.literal("organization.updated"),
  v.literal("organization.deleted"),
  v.literal("member.invited"),
  v.literal("member.joined"),
  v.literal("member.removed"),
  v.literal("member.role_changed"),
  v.literal("email.queued"),
  v.literal("email.delivered"),
  v.literal("email.opened"),
  v.literal("email.bounced"),
  v.literal("email.failed"),
  v.literal("other"),
);

export const logSecurityEvent = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.optional(v.string()),
    action: securityAuditActionTuple,
    resourceId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        description: v.optional(v.string()),
        source: v.optional(v.string()),
        sessionId: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args): Promise<Id<"audit_logs">> => {
    return await logAction(ctx, {
      organizationId: args.organizationId,
      userId: args.userId,
      actorType: "user",
      actorId: args.userId,
      action: args.action as AuditAction,
      resourceType: "other",
      resourceId: args.resourceId,
      ipAddress: args.ipAddress ?? "0.0.0.0",
      userAgent: args.userAgent,
      metadata: args.metadata,
    });
  },
});
