import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

/**
 * Audit Logs Table Schema
 *
 * Immutable audit trail for all significant actions in the system.
 * Required for legal compliance (eSign Act, UETA) and security auditing.
 *
 * Based on: /docs/design-phase/information-architecture/data-relationships.md
 * Feature: Audit Trail & Compliance - Feature #23
 */

// Action types for audit logging
export const auditActionTuple = v.union(
  // Document actions
  v.literal("document.created"),
  v.literal("document.updated"),
  v.literal("document.deleted"),
  v.literal("document.sent"),
  v.literal("document.viewed"),
  v.literal("document.completed"),
  v.literal("document.cancelled"),
  v.literal("document.expired"),
  v.literal("document.ownership_transferred"),

  // Signature field actions
  v.literal("field.created"),
  v.literal("field.updated"),
  v.literal("field.deleted"),

  // Recipient actions
  v.literal("recipient.added"),
  v.literal("recipient.updated"),
  v.literal("recipient.removed"),
  v.literal("recipient.viewed"),
  v.literal("recipient.signed"),
  v.literal("recipient.declined"),
  v.literal("recipient.esign_consent"),
  v.literal("recipient.esign_opt_out"),
  v.literal("recipient.expired"),
  v.literal("recipient.dictated"),

  // Signature actions
  v.literal("signature.created"),
  v.literal("signature.updated"),

  // Organization actions
  v.literal("organization.created"),
  v.literal("organization.updated"),
  v.literal("organization.deleted"),

  // Member actions
  v.literal("member.invited"),
  v.literal("member.joined"),
  v.literal("member.removed"),
  v.literal("member.role_changed"),

  // User actions
  v.literal("user.login"),
  v.literal("user.logout"),
  v.literal("user.updated"),

  // Email delivery actions
  v.literal("email.queued"),
  v.literal("email.delivered"),
  v.literal("email.opened"),
  v.literal("email.bounced"),
  v.literal("email.failed"),

  // Generic action for extensibility
  v.literal("other"),
);
export type AuditAction = Infer<typeof auditActionTuple>;

// Resource types that can be audited
export const auditResourceTypeTuple = v.union(
  v.literal("document"),
  v.literal("signature_field"),
  v.literal("recipient"),
  v.literal("signature"),
  v.literal("organization"),
  v.literal("user"),
  v.literal("member"),
  v.literal("email"),
  v.literal("other"),
);
export type AuditResourceType = Infer<typeof auditResourceTypeTuple>;

export const auditLogsTable = defineTable({
  // Scoping
  organizationId: v.id("organizations"), // Organization context

  // Actor Information
  userId: v.optional(v.string()), // auth subject (optional for recipient actions)
  actorType: v.union(v.literal("user"), v.literal("recipient"), v.literal("system")), // Who performed the action
  actorId: v.optional(v.string()), // ID of the actor (userId or recipientId)

  // Action Details
  action: auditActionTuple, // What action was performed
  resourceType: auditResourceTypeTuple, // Type of resource affected
  resourceId: v.optional(v.string()), // ID of the affected resource

  // Document Reference (for quick filtering)
  documentId: v.optional(v.id("documents")), // If action relates to a document

  // Recipient Reference (for signature tracking)
  recipientId: v.optional(v.id("document_recipients")), // If action performed by recipient

  // Change Tracking
  oldValues: v.optional(v.any()), // Previous state (for updates/deletes)
  newValues: v.optional(v.any()), // New state (for creates/updates)

  // Additional Context
  metadata: v.optional(
    v.object({
      description: v.optional(v.string()), // Human-readable description
      source: v.optional(v.string()), // Where action originated (web, api, system)
      sessionId: v.optional(v.string()), // Session identifier
    }),
  ),

  // Security Information
  ipAddress: v.string(), // IP address of actor
  userAgent: v.optional(v.string()), // Browser/device information

  // Timestamp (immutable, set once)
  createdAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_user", ["userId"])
  .index("by_document", ["documentId"])
  .index("by_recipient", ["recipientId"])
  .index("by_action", ["action"])
  .index("by_resource", ["resourceType", "resourceId"])
  .index("by_organization_created", ["organizationId", "createdAt"])
  .index("by_document_created", ["documentId", "createdAt"]);
