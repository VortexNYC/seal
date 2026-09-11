/**
 * Templates schema
 *
 * SEA-80/81: Document Templates
 *
 * Templates store reusable document configurations with pre-defined
 * signature fields that can be copied to create new documents.
 */

import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

export const templateStatusTuple = v.union(
  v.literal("active"),
  v.literal("archived"),
  v.literal("deleted")
);
export type TemplateStatus = Infer<typeof templateStatusTuple>;

export const templatesTable = defineTable({
  // Ownership & Scoping
  betterAuthOrganizationId: v.optional(v.string()),
  betterAuthCreatedBy: v.optional(v.string()),
  organizationId: v.id("organizations"),
  createdBy: v.id("users"),

  // Template metadata
  name: v.string(),
  description: v.optional(v.string()),

  // Source document info (optional - template may be created from a document)
  sourceDocumentId: v.optional(v.id("documents")),

  // Folder organization
  folderId: v.optional(v.id("folders")),

  // PDF storage - templates store a copy of the PDF
  storageId: v.string(), // ID returned from storage.store()
  fileSize: v.number(),
  fileType: v.string(), // MIME type (e.g., "application/pdf")
  pageCount: v.optional(v.number()),

  // Thumbnail for display
  thumbnailDataUrl: v.optional(v.string()),

  // Usage tracking
  useCount: v.number(), // How many documents created from this template

  // Status
  status: templateStatusTuple,

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_better_auth_organization", ["betterAuthOrganizationId"])
  .index("by_creator", ["createdBy"])
  .index("by_better_auth_creator", ["betterAuthCreatedBy"])
  .index("by_status", ["status"])
  .index("by_organization_status", ["organizationId", "status"])
  .index("by_better_auth_organization_status", [
    "betterAuthOrganizationId",
    "status",
  ])
  .index("by_use_count", ["useCount"])
  .index("by_folder", ["folderId"]);

/**
 * Template fields - stores the signature/form fields defined in the template
 * These are copied to signature_fields when a document is created from the template
 */
export const templateFieldsTable = defineTable({
  templateId: v.id("templates"),

  // Field configuration (mirrors signature_fields schema)
  fieldType: v.string(), // "signature" | "text" | "date" | "checkbox" | "dropdown" | "radio" | "attachment"
  label: v.optional(v.string()),
  isRequired: v.boolean(),

  // Position (percentage-based coordinates)
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
  page: v.number(),

  // Field-specific properties (e.g., options for dropdown/radio)
  properties: v.optional(
    v.object({
      options: v.optional(v.array(v.string())),
      placeholder: v.optional(v.string()),
      defaultValue: v.optional(v.string()),
    })
  ),

  // Order for sequential assignment to recipients
  order: v.number(),

  // Timestamps
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_template", ["templateId"])
  .index("by_template_page", ["templateId", "page"])
  .index("by_template_order", ["templateId", "order"]);
