import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";
import { documentWorkflowStatusTuple } from "./document_workflow_status";

export const documentSharingModeTuple = v.union(
	v.literal("private"), // Owner only
	v.literal("workspace"), // All team members (Pro plan only)
	v.literal("specific"), // Specific users only (Pro plan only)
);
export type DocumentSharingMode = Infer<typeof documentSharingModeTuple>;

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

	// Convex Storage reference
	storageId: v.string(), // ID returned from storage.store()

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
	.index("by_owner_workflow", ["ownerId", "workflowStatus"]);
