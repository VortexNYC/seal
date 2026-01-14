/**
 * @fileoverview Zod validation schemas for the Seal public API.
 * These schemas are shared between the backend API and MCP server.
 *
 * @module validations/api
 */

import { z } from "zod";

// =============================================================================
// Shared Enums
// =============================================================================

/** Document workflow status values */
export const documentStatusSchema = z.enum([
	"draft",
	"sent",
	"in_progress",
	"completed",
	"cancelled",
	"declined",
]);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

/** Recipient role values */
export const recipientRoleSchema = z.enum(["signer", "approver", "viewer"]);
export type RecipientRole = z.infer<typeof recipientRoleSchema>;

/** Recipient status values */
export const recipientStatusSchema = z.enum([
	"pending",
	"viewed",
	"signed",
	"approved",
	"declined",
]);
export type RecipientStatus = z.infer<typeof recipientStatusSchema>;

/** Template status values */
export const templateStatusSchema = z.enum(["active", "archived"]);
export type TemplateStatus = z.infer<typeof templateStatusSchema>;

/** Signature method values */
export const signatureMethodSchema = z.enum(["draw", "type", "upload"]);
export type SignatureMethod = z.infer<typeof signatureMethodSchema>;

/** Field type values */
export const fieldTypeSchema = z.enum([
	"signature",
	"text",
	"date",
	"checkbox",
	"dropdown",
	"radio",
	"attachment",
]);
export type FieldType = z.infer<typeof fieldTypeSchema>;

// =============================================================================
// Document Schemas
// =============================================================================

/** Schema for listing documents */
export const listDocumentsSchema = z.object({
	limit: z
		.number()
		.min(1)
		.max(100)
		.optional()
		.describe("Maximum number of documents to return (1-100, default 20)"),
	cursor: z
		.string()
		.optional()
		.describe("Pagination cursor from previous response"),
	status: documentStatusSchema.optional().describe("Filter by workflow status"),
});
export type ListDocumentsInput = z.infer<typeof listDocumentsSchema>;

/** Schema for getting a single document */
export const getDocumentSchema = z.object({
	id: z.string().describe("The document ID"),
	include_recipients: z
		.boolean()
		.optional()
		.describe("Include recipient details in response (default false)"),
});
export type GetDocumentInput = z.infer<typeof getDocumentSchema>;

/** Schema for creating a document */
export const createDocumentSchema = z.object({
	title: z.string().describe("Document title"),
	description: z.string().optional().describe("Document description"),
	storage_id: z
		.string()
		.describe("Convex storage ID for the uploaded PDF file"),
	file_size: z.number().describe("File size in bytes"),
	file_type: z
		.string()
		.optional()
		.describe("MIME type (default: application/pdf)"),
	page_count: z.number().optional().describe("Number of pages in the document"),
	deadline: z
		.string()
		.optional()
		.describe("Signing deadline as ISO 8601 timestamp"),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

/** Schema for updating a document */
export const updateDocumentSchema = z.object({
	id: z.string().describe("The document ID"),
	title: z.string().optional().describe("New document title"),
	description: z.string().optional().describe("New document description"),
	deadline: z
		.string()
		.optional()
		.describe("New signing deadline as ISO 8601 timestamp"),
});
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

/** Schema for document ID only operations */
export const documentIdSchema = z.object({
	id: z.string().describe("The document ID"),
});
export type DocumentIdInput = z.infer<typeof documentIdSchema>;

/** Schema for sending a document */
export const sendDocumentSchema = z.object({
	id: z.string().describe("The document ID"),
	message: z
		.string()
		.optional()
		.describe("Custom message to include in the signing email"),
});
export type SendDocumentInput = z.infer<typeof sendDocumentSchema>;

/** Schema for voiding a document */
export const voidDocumentSchema = z.object({
	id: z.string().describe("The document ID"),
	reason: z.string().describe("Reason for voiding the document"),
});
export type VoidDocumentInput = z.infer<typeof voidDocumentSchema>;

// =============================================================================
// Recipient Schemas
// =============================================================================

/** Schema for listing recipients */
export const listRecipientsSchema = z.object({
	document_id: z.string().describe("The document ID"),
});
export type ListRecipientsInput = z.infer<typeof listRecipientsSchema>;

/** Schema for getting a recipient */
export const getRecipientSchema = z.object({
	document_id: z.string().describe("The document ID"),
	id: z.string().describe("The recipient ID"),
});
export type GetRecipientInput = z.infer<typeof getRecipientSchema>;

/** Schema for adding a recipient */
export const addRecipientSchema = z.object({
	document_id: z.string().describe("The document ID"),
	email: z.string().email().describe("Recipient email address"),
	name: z.string().describe("Recipient display name"),
	role: recipientRoleSchema.describe(
		"Recipient role: signer (needs to sign), approver (needs to approve), viewer (view only)",
	),
	order: z
		.number()
		.optional()
		.describe("Signing order (for sequential signing workflows)"),
	message: z.string().optional().describe("Custom message for this recipient"),
});
export type AddRecipientInput = z.infer<typeof addRecipientSchema>;

/** Schema for updating a recipient */
export const updateRecipientSchema = z.object({
	document_id: z.string().describe("The document ID"),
	id: z.string().describe("The recipient ID"),
	name: z.string().optional().describe("New display name"),
	role: recipientRoleSchema.optional().describe("New recipient role"),
	order: z.number().optional().describe("New signing order"),
	message: z.string().optional().describe("New custom message"),
});
export type UpdateRecipientInput = z.infer<typeof updateRecipientSchema>;

/** Schema for removing a recipient */
export const removeRecipientSchema = z.object({
	document_id: z.string().describe("The document ID"),
	id: z.string().describe("The recipient ID"),
});
export type RemoveRecipientInput = z.infer<typeof removeRecipientSchema>;

/** Schema for sending a reminder */
export const sendReminderSchema = z.object({
	document_id: z.string().describe("The document ID"),
	id: z.string().describe("The recipient ID"),
	message: z.string().optional().describe("Custom reminder message"),
});
export type SendReminderInput = z.infer<typeof sendReminderSchema>;

// =============================================================================
// Template Schemas
// =============================================================================

/** Schema for listing templates */
export const listTemplatesSchema = z.object({
	limit: z
		.number()
		.min(1)
		.max(100)
		.optional()
		.describe("Maximum number of templates to return (1-100, default 20)"),
	cursor: z
		.string()
		.optional()
		.describe("Pagination cursor from previous response"),
	status: templateStatusSchema.optional().describe("Filter by template status"),
});
export type ListTemplatesInput = z.infer<typeof listTemplatesSchema>;

/** Schema for getting a template */
export const getTemplateSchema = z.object({
	id: z.string().describe("The template ID"),
	include_fields: z
		.boolean()
		.optional()
		.describe("Include field definitions in response (default false)"),
});
export type GetTemplateInput = z.infer<typeof getTemplateSchema>;

/** Schema for template ID only operations */
export const templateIdSchema = z.object({
	id: z.string().describe("The template ID"),
});
export type TemplateIdInput = z.infer<typeof templateIdSchema>;

/** Schema for creating a template */
export const createTemplateSchema = z.object({
	document_id: z
		.string()
		.describe("Source document ID to create template from"),
	name: z.string().describe("Template name"),
	description: z.string().optional().describe("Template description"),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

/** Schema for updating a template */
export const updateTemplateSchema = z.object({
	id: z.string().describe("The template ID"),
	name: z.string().optional().describe("New template name"),
	description: z.string().optional().describe("New template description"),
	status: templateStatusSchema.optional().describe("New template status"),
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

/** Schema for using a template */
export const useTemplateSchema = z.object({
	id: z.string().describe("The template ID"),
	title: z
		.string()
		.optional()
		.describe("Title for the new document (defaults to template name)"),
	description: z
		.string()
		.optional()
		.describe("Description for the new document"),
});
export type UseTemplateInput = z.infer<typeof useTemplateSchema>;

// =============================================================================
// Signature Schemas
// =============================================================================

/** Schema for document_id parameter */
export const signatureDocumentIdSchema = z.object({
	document_id: z.string().describe("The document ID"),
});
export type SignatureDocumentIdInput = z.infer<
	typeof signatureDocumentIdSchema
>;

/** Schema for getting a signature */
export const getSignatureSchema = z.object({
	document_id: z.string().describe("The document ID"),
	id: z.string().describe("The signature ID"),
});
export type GetSignatureInput = z.infer<typeof getSignatureSchema>;

/** Schema for getting audit trail */
export const getAuditTrailSchema = z.object({
	document_id: z.string().describe("The document ID"),
	limit: z
		.number()
		.min(1)
		.max(100)
		.optional()
		.describe("Maximum number of audit entries to return"),
});
export type GetAuditTrailInput = z.infer<typeof getAuditTrailSchema>;

// =============================================================================
// Upload Schemas
// =============================================================================

/** Schema for uploading a file from local path (stdio mode only) */
export const uploadFileSchema = z.object({
	file_path: z.string().describe("Absolute path to the PDF file to upload"),
});
export type UploadFileInput = z.infer<typeof uploadFileSchema>;

/** Schema for uploading a file from base64 content (works in all modes) */
export const uploadFileContentSchema = z.object({
	file_name: z.string().describe("Name of the file (e.g., 'document.pdf')"),
	content_base64: z.string().describe("Base64-encoded PDF file content"),
});
export type UploadFileContentInput = z.infer<typeof uploadFileContentSchema>;

// =============================================================================
// API Response Types
// =============================================================================

/** Document response from API */
export interface ApiDocument {
	id: string;
	title: string;
	description?: string;
	status: DocumentStatus;
	created_at: string;
	updated_at: string;
	recipients_count: number;
	signed_count: number;
	deadline?: string;
	download_url?: string;
	recipients?: ApiRecipient[];
}

/** Recipient response from API */
export interface ApiRecipient {
	id: string;
	email: string;
	name: string;
	role: RecipientRole;
	status: RecipientStatus;
	order?: number;
	signed_at?: string;
	viewed_at?: string;
	declined_at?: string;
	decline_reason?: string;
}

/** Template response from API */
export interface ApiTemplate {
	id: string;
	name: string;
	description?: string;
	status: TemplateStatus;
	created_at: string;
	updated_at: string;
	use_count: number;
	field_count?: number;
}

/** Template field response from API */
export interface ApiTemplateField {
	id: string;
	field_type: FieldType;
	label: string;
	is_required: boolean;
	page: number;
	x: number;
	y: number;
	width: number;
	height: number;
	properties?: {
		placeholder?: string;
		default_value?: string;
		options?: string[];
	};
}

/** Signature response from API */
export interface ApiSignature {
	id: string;
	field_id: string;
	recipient_id: string;
	document_id: string;
	value?: string;
	signature_image_url?: string;
	signature_method: SignatureMethod;
	signed_at: string;
	ip_address?: string;
	user_agent?: string;
}

/** Audit trail entry from API */
export interface ApiAuditEntry {
	id: string;
	event_type: string;
	actor_email?: string;
	actor_name?: string;
	timestamp: string;
	ip_address?: string;
	user_agent?: string;
	details?: Record<string, unknown>;
}

/** Signature verification response from API */
export interface ApiVerificationResult {
	is_valid: boolean;
	document_hash: string;
	signatures: Array<{
		id: string;
		recipient_email: string;
		is_valid: boolean;
		signed_at: string;
		signature_hash: string;
	}>;
	verification_timestamp: string;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
	data: T[];
	has_more: boolean;
	next_cursor?: string;
}

/** API error response (RFC 7807) */
export interface ApiError {
	type: string;
	status: number;
	title: string;
	details?: Record<string, unknown>;
}

/** @deprecated Use ApiError instead */
export type ApiErrorResponse = ApiError;
