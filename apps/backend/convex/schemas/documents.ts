import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

import { documentWorkflowStatusTuple } from "./document_workflow_status";

export const documentSharingModeTuple = v.union(
  v.literal("private"), // Owner only
  v.literal("workspace"), // All team members (Pro plan only)
  v.literal("specific"), // Specific users only (Pro plan only)
);
export type DocumentSharingMode = Infer<typeof documentSharingModeTuple>;

export const signingModeTuple = v.union(
  v.literal("parallel"), // All recipients at once (default)
  v.literal("sequential"), // Enforce recipient order groups
);
export type SigningMode = Infer<typeof signingModeTuple>;

export const documentStatusTuple = v.union(
  v.literal("active"),
  v.literal("archived"),
  v.literal("deleted"),
);
export type DocumentStatus = Infer<typeof documentStatusTuple>;

export const documentsTable = defineTable({
  // Ownership & Scoping
  organizationId: v.id("organizations"),
  ownerId: v.id("users"),

  // Document metadata
  name: v.string(),
  description: v.optional(v.string()),
  fileSize: v.number(),
  fileType: v.string(), // MIME type (e.g., "application/pdf")
  pageCount: v.optional(v.number()), // Number of pages in the PDF (SEA-64)
  thumbnailDataUrl: v.optional(v.string()), // Base64 data URL of first page thumbnail (SEA-69)

  // Template reference (if created from a template)
  sourceTemplateId: v.optional(v.id("templates")),

  // Convex Storage reference
  storageId: v.string(), // ID returned from storage.store() - Original uploaded PDF
  fillableStorageId: v.optional(v.string()), // ID of the fillable PDF with embedded form fields (SEA-100)
  signedStorageId: v.optional(v.string()), // ID of the digitally signed PDF (SEA-108)
  certificateStorageId: v.optional(v.string()), // ID of the completion certificate PDF

  // Cryptographic hash for document integrity verification (SEA-108)
  documentHash: v.optional(v.string()), // SHA-256 hash of original PDF

  // Extracted text content for search indexing
  extractedText: v.optional(v.string()), // Full text extracted from PDF pages

  // AI processing pipeline status
  aiProcessingStatus: v.optional(
    v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
  ),

  // Search indexing
  searchIndexedAt: v.optional(v.number()), // When document was last embedded for search

  // Sharing configuration
  sharingMode: documentSharingModeTuple,

  // Lifecycle status (active/archived/deleted)
  status: documentStatusTuple,

  // Workflow status (draft/sent/in_progress/completed/cancelled/declined)
  // Optional to support migration from existing documents
  workflowStatus: v.optional(documentWorkflowStatusTuple),

  // Workflow timestamps
  sentAt: v.optional(v.number()), // When document was sent to recipients
  completedAt: v.optional(v.number()), // When all signatures were collected
  cancelledAt: v.optional(v.number()), // When workflow was cancelled
  declinedAt: v.optional(v.number()), // When first recipient declined

  // SEA-119: Signing deadline for recipients
  deadline: v.optional(v.number()), // Timestamp when signing must be completed by
  expirationAlertsSent: v.optional(v.array(v.number())), // Days-remaining values already alerted

  // Retention policy: completed documents must be retained for 7 years (ESIGN Act)
  retainUntil: v.optional(v.number()), // Timestamp after which the document can be deleted

  // Signing mode: parallel (all at once) or sequential (enforce order groups)
  signingMode: v.optional(signingModeTuple),

  // Embedded signing configuration (iFrame SDK)
  embeddingConfig: v.optional(
    v.object({
      enabled: v.boolean(),
      allowedOrigins: v.optional(v.array(v.string())),
      hideDeclineButton: v.optional(v.boolean()),
      redirectUrl: v.optional(v.string()),
    }),
  ),

  // Version tracking
  currentVersion: v.optional(v.number()), // Current version number (1-based), optional for migration

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_owner", ["ownerId"])
  .index("by_status", ["status"])
  .index("by_sharing_mode", ["sharingMode"])
  .index("by_organization_status", ["organizationId", "status"])
  .index("by_workflow_status", ["workflowStatus"])
  .index("by_organization_workflow", ["organizationId", "workflowStatus"])
  .index("by_owner_workflow", ["ownerId", "workflowStatus"])
  .searchIndex("search_text", {
    searchField: "extractedText",
    filterFields: ["organizationId", "status"],
  });
