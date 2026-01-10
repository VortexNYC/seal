/**
 * API response types for the Seal MCP server.
 * These types match the API responses from the Seal backend.
 */

/** Document workflow status */
export type DocumentStatus =
	| "draft"
	| "sent"
	| "in_progress"
	| "completed"
	| "cancelled"
	| "declined";

/** Recipient role in a document */
export type RecipientRole = "signer" | "approver" | "viewer";

/** Recipient status in a document */
export type RecipientStatus =
	| "pending"
	| "viewed"
	| "signed"
	| "approved"
	| "declined";

/** Signature method */
export type SignatureMethod = "draw" | "type" | "upload";

/** Template status */
export type TemplateStatus = "active" | "archived" | "deleted";

/** Field type */
export type FieldType =
	| "signature"
	| "text"
	| "date"
	| "checkbox"
	| "dropdown"
	| "radio"
	| "attachment";

/**
 * Document response from API
 */
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

/**
 * Recipient response from API
 */
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

/**
 * Template response from API
 */
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

/**
 * Template field response from API
 */
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

/**
 * Signature response from API
 */
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

/**
 * Audit trail entry from API
 */
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

/**
 * Signature verification response from API
 */
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

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
	data: T[];
	has_more: boolean;
	next_cursor?: string;
}

/**
 * API error response (RFC 7807)
 */
export interface ApiError {
	type: string;
	status: number;
	title: string;
	details?: Record<string, unknown>;
}
