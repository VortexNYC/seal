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
  cursor: z.string().optional().describe("Pagination cursor from previous response"),
  status: documentStatusSchema.optional().describe("Filter by workflow status"),
  title_search: z
    .string()
    .optional()
    .describe("Case-insensitive substring search on document title"),
  created_after: z
    .string()
    .optional()
    .describe("Return documents created after this ISO 8601 timestamp (e.g. 2025-01-01T00:00:00Z)"),
  created_before: z
    .string()
    .optional()
    .describe(
      "Return documents created before this ISO 8601 timestamp (e.g. 2025-12-31T23:59:59Z)",
    ),
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
  storage_id: z.string().describe("Convex storage ID for the uploaded PDF file"),
  file_size: z.number().describe("File size in bytes"),
  file_type: z.string().optional().describe("MIME type (default: application/pdf)"),
  page_count: z.number().optional().describe("Number of pages in the document"),
  deadline: z.string().optional().describe("Signing deadline as ISO 8601 timestamp"),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

/** Schema for updating a document */
export const updateDocumentSchema = z.object({
  id: z.string().describe("The document ID"),
  title: z.string().optional().describe("New document title"),
  description: z.string().optional().describe("New document description"),
  deadline: z.string().optional().describe("New signing deadline as ISO 8601 timestamp"),
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
  message: z.string().optional().describe("Custom message to include in the signing email"),
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
  name: z
    .string()
    .min(1, "Recipient name cannot be empty")
    .refine((val) => val.trim().length > 0, "Recipient name cannot be empty")
    .describe("Recipient display name"),
  role: recipientRoleSchema.describe(
    "Recipient role: signer (needs to sign), approver (needs to approve), viewer (view only)",
  ),
  order: z.number().optional().describe("Signing order (for sequential signing workflows)"),
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

/** Schema for bulk adding recipients */
export const addRecipientsBulkSchema = z.object({
  document_id: z.string().describe("The document ID"),
  recipients: z
    .array(addRecipientSchema.omit({ document_id: true }))
    .describe("Array of recipients to add"),
});
export type AddRecipientsBulkInput = z.infer<typeof addRecipientsBulkSchema>;

/** Schema for bulk updating recipients */
export const updateRecipientsBulkSchema = z.object({
  document_id: z.string().describe("The document ID"),
  updates: z
    .array(
      updateRecipientSchema.omit({ document_id: true }).extend({
        id: z.string().describe("The recipient ID to update"),
      }),
    )
    .describe("Array of recipient updates"),
});
export type UpdateRecipientsBulkInput = z.infer<typeof updateRecipientsBulkSchema>;

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
  cursor: z.string().optional().describe("Pagination cursor from previous response"),
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
  document_id: z.string().describe("Source document ID to create template from"),
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
  title: z.string().optional().describe("Title for the new document (defaults to template name)"),
  description: z.string().optional().describe("Description for the new document"),
});
export type UseTemplateInput = z.infer<typeof useTemplateSchema>;

// =============================================================================
// Signature Schemas
// =============================================================================

/** Schema for document_id parameter */
export const signatureDocumentIdSchema = z.object({
  document_id: z.string().describe("The document ID"),
});
export type SignatureDocumentIdInput = z.infer<typeof signatureDocumentIdSchema>;

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
// Account Schemas
// =============================================================================

/** Schema for getting account info (no args) */
export const getAccountInfoSchema = z.object({});
export type GetAccountInfoInput = z.infer<typeof getAccountInfoSchema>;

/** Account/organization info response */
export interface ApiAccountInfo {
  name: string;
  slug: string;
  type: "personal" | "group" | "company";
  timezone: string;
  status: "active" | "suspended" | "deleted";
  members: {
    total: number;
    active: number;
    by_role: { owner: number; admin: number; member: number; viewer: number };
  };
  documents: {
    total: number;
    draft: number;
    sent: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    declined: number;
  };
  signing_settings: {
    allowed_signature_types: string[];
    default_deadline_days: number;
  };
  ai_enabled: boolean;
}

// =============================================================================
// Webhook Schemas
// =============================================================================

/** Webhook endpoint status values */
export const webhookStatusSchema = z.enum(["active", "paused", "disabled"]);
export type WebhookStatus = z.infer<typeof webhookStatusSchema>;

/** All supported webhook event types */
export const webhookEventTypeSchema = z.enum([
  "document.created",
  "document.sent",
  "document.viewed",
  "document.completed",
  "document.voided",
  "document.expired",
  "document.declined",
  "recipient.added",
  "recipient.viewed",
  "recipient.signed",
  "recipient.approved",
  "recipient.declined",
  "recipient.reminded",
  "template.created",
  "template.updated",
  "template.used",
]);
export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;

/** Schema for listing webhooks (no args — returns all for the org) */
export const listWebhooksSchema = z.object({});
export type ListWebhooksInput = z.infer<typeof listWebhooksSchema>;

/** Schema for getting a single webhook */
export const getWebhookSchema = z.object({
  id: z.string().describe("The webhook endpoint ID"),
});
export type GetWebhookInput = z.infer<typeof getWebhookSchema>;

/** Schema for creating a webhook */
export const createWebhookSchema = z.object({
  name: z.string().describe("Friendly name for the webhook endpoint (max 100 chars)"),
  url: z.string().url().describe("HTTPS URL to send webhook events to"),
  events: z
    .array(webhookEventTypeSchema)
    .describe("Event types to subscribe to. Pass an empty array to receive all events."),
  description: z.string().optional().describe("Optional description of this webhook endpoint"),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

/** Schema for updating a webhook */
export const updateWebhookSchema = z.object({
  id: z.string().describe("The webhook endpoint ID"),
  name: z.string().optional().describe("New friendly name"),
  url: z.string().url().optional().describe("New HTTPS delivery URL"),
  events: z
    .array(webhookEventTypeSchema)
    .optional()
    .describe("New set of event types to subscribe to"),
  description: z.string().optional().describe("New description"),
  status: webhookStatusSchema
    .optional()
    .describe("New status: active (delivering), paused (temporarily stopped), disabled (failed)"),
});
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

/** Schema for webhook ID-only operations (delete, rotate secret) */
export const webhookIdSchema = z.object({
  id: z.string().describe("The webhook endpoint ID"),
});
export type WebhookIdInput = z.infer<typeof webhookIdSchema>;

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

/** Webhook endpoint response from API */
export interface ApiWebhookEndpoint {
  id: string;
  name: string;
  url: string;
  status: WebhookStatus;
  events: string[];
  description?: string;
  secret_prefix: string;
  created_at: string;
  updated_at: string;
  stats: {
    total_deliveries: number;
    successful: number;
    failed: number;
    success_rate: number;
  };
}

/** Webhook event type info */
export interface ApiWebhookEventType {
  type: string;
  category: string;
  description: string;
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

// =============================================================================
// Members Schemas
// =============================================================================

/** Member role values */
export const memberRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);
export type MemberRole = z.infer<typeof memberRoleSchema>;

/** Schema for listing members */
export const listMembersSchema = z.object({
  role: memberRoleSchema.optional().describe("Filter by role"),
});
export type ListMembersInput = z.infer<typeof listMembersSchema>;

/** Schema for getting a single member */
export const getMemberSchema = z.object({
  id: z.string().describe("Membership record ID"),
});
export type GetMemberInput = z.infer<typeof getMemberSchema>;

/** Member response from API */
export interface ApiMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: MemberRole;
  status: string;
  joined_at: string;
}

// =============================================================================
// Settings Schemas
// =============================================================================

/** Schema for updating org settings */
export const updateSettingsSchema = z.object({
  signing: z
    .object({
      allowed_signature_types: z
        .array(z.enum(["draw", "type", "upload"]))
        .optional()
        .describe("Allowed signature input methods"),
      default_deadline_days: z
        .number()
        .min(1)
        .max(365)
        .optional()
        .describe("Default deadline in days (1–365)"),
      esign_consent_text: z
        .string()
        .nullable()
        .optional()
        .describe("Custom ESIGN consent text (null = use default)"),
    })
    .optional()
    .describe("Signing configuration"),
  notifications: z
    .object({
      reminder_schedule: z
        .array(z.number())
        .optional()
        .describe("Days after sending to auto-remind (e.g. [3, 7, 14])"),
      expiration_alert_days: z
        .number()
        .min(0)
        .max(30)
        .optional()
        .describe("Days before deadline to send expiration alert"),
      send_completion_email: z
        .boolean()
        .optional()
        .describe("Notify owner when all parties complete signing"),
      send_viewed_notification: z
        .boolean()
        .optional()
        .describe("Notify owner when a recipient views the document"),
    })
    .optional()
    .describe("Email notification preferences"),
  ai: z
    .object({
      enabled: z.boolean().optional().describe("Enable AI features"),
      auto_analyze: z.boolean().optional().describe("Auto-analyze new documents"),
    })
    .optional()
    .describe("AI configuration"),
  security: z
    .object({
      ip_allowlist: z
        .array(z.string())
        .optional()
        .describe("Allowed IP ranges in CIDR notation (empty = all IPs allowed)"),
      allow_api_access: z.boolean().optional().describe("Whether API access is enabled"),
      require_mfa: z.boolean().optional().describe("Require MFA for all members"),
      session_timeout_minutes: z
        .number()
        .nullable()
        .optional()
        .describe("Session timeout in minutes (null = browser default)"),
    })
    .optional()
    .describe("Security configuration"),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

/** Settings response from API */
export interface ApiSettings {
  signing: {
    allowed_signature_types: ("draw" | "type" | "upload")[];
    default_deadline_days: number;
    esign_consent_text: string | null;
  };
  notifications: {
    reminder_schedule: number[];
    expiration_alert_days: number;
    send_completion_email: boolean;
    send_viewed_notification: boolean;
  };
  ai: {
    enabled: boolean;
    auto_analyze: boolean;
  };
  security: {
    ip_allowlist: string[];
    allow_api_access: boolean;
    require_mfa: boolean;
    session_timeout_minutes: number | null;
  };
}

// =============================================================================
// Audit Log Schemas
// =============================================================================

/** Schema for listing org-wide audit log */
export const listAuditLogSchema = z.object({
  limit: z.number().min(1).max(100).optional().describe("Number of entries (1–100, default 20)"),
  cursor: z.string().optional().describe("Pagination cursor from previous response"),
  document_id: z.string().optional().describe("Filter by document ID"),
  action: z.string().optional().describe("Filter by action type (e.g. document.signed)"),
  created_after: z.string().optional().describe("Return entries after this ISO 8601 timestamp"),
  created_before: z.string().optional().describe("Return entries before this ISO 8601 timestamp"),
});
export type ListAuditLogInput = z.infer<typeof listAuditLogSchema>;

/** Audit log entry from API */
export interface ApiAuditLogEntry {
  id: string;
  action: string;
  actor_type: string;
  actor_name?: string;
  actor_email?: string;
  resource_type: string;
  resource_id?: string;
  document_id?: string;
  ip_address?: string;
  source?: string;
  created_at: string;
}

// =============================================================================
// Contacts Schemas
// =============================================================================

/** Contact status values */
export const contactStatusSchema = z.enum(["active", "inactive", "lead"]);
export type ContactStatus = z.infer<typeof contactStatusSchema>;

/** Schema for listing contacts */
export const listContactsSchema = z.object({
  limit: z.number().min(1).max(100).optional().describe("Number of results (1–100, default 20)"),
  cursor: z.string().optional().describe("Pagination cursor from previous response"),
  status: contactStatusSchema.optional().describe("Filter by status"),
  search: z.string().optional().describe("Search by name or email"),
});
export type ListContactsInput = z.infer<typeof listContactsSchema>;

/** Schema for getting a single contact */
export const getContactSchema = z.object({
  id: z.string().describe("Contact ID"),
});
export type GetContactInput = z.infer<typeof getContactSchema>;

/** Schema for creating a contact */
export const createContactSchema = z.object({
  first_name: z.string().describe("First name"),
  last_name: z.string().describe("Last name"),
  email: z.string().email().describe("Email address"),
  phone: z.string().optional().describe("Phone number"),
  company: z.string().optional().describe("Company or organization"),
  title: z.string().optional().describe("Job title"),
  status: contactStatusSchema.optional().describe("Contact status (default: active)"),
  notes: z.string().optional().describe("Free-form notes"),
  tags: z.array(z.string()).optional().describe("Tags for categorization"),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;

/** Schema for deleting a contact */
export const deleteContactSchema = z.object({
  id: z.string().describe("Contact ID"),
});
export type DeleteContactInput = z.infer<typeof deleteContactSchema>;

/** Contact response from API */
export interface ApiContact {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  status: ContactStatus;
  notes?: string;
  tags?: string[];
  last_contacted_at?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Document Access Schemas
// =============================================================================

/** Document sharing mode values */
export const documentSharingModeSchema = z.enum(["private", "workspace", "specific"]);
export type DocumentSharingMode = z.infer<typeof documentSharingModeSchema>;

/** Schema for getting document access */
export const getDocumentAccessSchema = z.object({
  id: z.string().describe("Document ID"),
});
export type GetDocumentAccessInput = z.infer<typeof getDocumentAccessSchema>;

/** Schema for updating document access */
export const updateDocumentAccessSchema = z.object({
  id: z.string().describe("Document ID"),
  sharing_mode: documentSharingModeSchema.describe(
    "Who can access: private (owner only), workspace (all members), specific (granted users only)",
  ),
});
export type UpdateDocumentAccessInput = z.infer<typeof updateDocumentAccessSchema>;

/** Document access response */
export interface ApiDocumentAccess {
  document_id: string;
  sharing_mode: DocumentSharingMode;
}

// =============================================================================
// Bulk Document Operations Schemas
// =============================================================================

/** Schema for bulk voiding documents */
export const bulkVoidDocumentsSchema = z.object({
  document_ids: z
    .array(z.string())
    .min(1)
    .max(50)
    .describe("Array of document IDs to void (max 50)"),
  reason: z.string().describe("Reason for voiding the documents"),
});
export type BulkVoidDocumentsInput = z.infer<typeof bulkVoidDocumentsSchema>;

/** Schema for bulk sending documents */
export const bulkSendDocumentsSchema = z.object({
  document_ids: z
    .array(z.string())
    .min(1)
    .max(50)
    .describe("Array of draft document IDs to send (max 50, each must have recipients)"),
  message: z.string().optional().describe("Custom message to include in signing emails"),
});
export type BulkSendDocumentsInput = z.infer<typeof bulkSendDocumentsSchema>;

/** Result of a single operation in a bulk request */
export interface BulkOperationResult {
  id: string;
  success: boolean;
  error?: string;
}

/** Summary returned from bulk operations */
export interface BulkOperationSummary {
  succeeded: number;
  failed: number;
  total_requested: number;
  results: BulkOperationResult[];
}

// =============================================================================
// Analytics Schemas
// =============================================================================

/** Schema for getting analytics */
export const getAnalyticsSchema = z.object({
  from: z
    .string()
    .optional()
    .describe("Start of date range as ISO 8601 timestamp (default: 30 days ago)"),
  to: z.string().optional().describe("End of date range as ISO 8601 timestamp (default: now)"),
});
export type GetAnalyticsInput = z.infer<typeof getAnalyticsSchema>;

/** Analytics response from API */
export interface ApiAnalytics {
  period: { from: string; to: string };
  documents: {
    total_created: number;
    total_sent: number;
    total_completed: number;
    total_cancelled: number;
    total_declined: number;
    completion_rate: number;
    median_signing_hours: number | null;
  };
  workspace_snapshot: {
    draft: number;
    sent: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    declined: number;
  };
}
