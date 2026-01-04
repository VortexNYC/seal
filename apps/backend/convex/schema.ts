import { defineSchema } from "convex/server";
import type { Infer } from "convex/values";
import {
	type ApiKeyScope,
	apiKeysTable,
	connectedAppsTable,
	integrationActivityLogsTable,
} from "./schemas/api_keys";
import {
	type AuditAction,
	type AuditResourceType,
	auditLogsTable,
} from "./schemas/audit_logs";
import {
	type DocumentPermissionLevel,
	documentAccessTable,
} from "./schemas/document_access";
import {
	type RecipientStatus as DocumentRecipientStatus,
	documentRecipientsTable,
	type RecipientRole,
} from "./schemas/document_recipients";
import {
	documentRemindersTable,
	type ReminderStatus,
	type ReminderType,
} from "./schemas/document_reminders";
import {
	type DocumentSharingMode,
	type DocumentStatus,
	documentsTable,
} from "./schemas/documents";
import {
	type EmailStatus,
	type EmailType,
	emailLogsTable,
} from "./schemas/email_logs";
import {
	type NotificationType,
	notificationsTable,
} from "./schemas/notifications";
import { organizationInvitationsTable } from "./schemas/organization_invitations";
import {
	type OrganizationMemberRole,
	type OrganizationMemberStatus,
	organizationMembersTable,
} from "./schemas/organization_members";
import {
	type OrganizationRoleType,
	organizationRolesTable,
} from "./schemas/organization_roles";
import {
	type OrganizationStatus,
	organizationsTable,
	type organizationTypeTuple,
} from "./schemas/organizations";
import {
	type AuthenticationMethod,
	recipientsTable,
	type RecipientStatus as WorkflowRecipientStatus,
} from "./schemas/recipients";
import {
	type SignatureType,
	savedSignaturesTable,
} from "./schemas/saved_signatures";
import {
	type FieldType,
	signatureFieldsTable,
} from "./schemas/signature_fields";
import { signaturesTable } from "./schemas/signatures";
import { subscriptionPricesTable } from "./schemas/subscription_prices";
import { subscriptionProductsTable } from "./schemas/subscription_products";
import { subscriptionsTable } from "./schemas/subscriptions";
import {
	type TemplateStatus,
	templateFieldsTable,
	templatesTable,
} from "./schemas/templates";
import { userProfilesTable } from "./schemas/user_profiles";
import { type UserStatus, usersTable } from "./schemas/users";
import {
	type WebhookDeliveryStatus,
	type WebhookEndpointStatus,
	type WebhookEventType,
	webhookDeliveries,
	webhookEndpoints,
} from "./schemas/webhooks";

// Re-export types for use in other files
export type MemberStatus = UserStatus; // Member status uses the same values as user status
export type OrganizationRole = OrganizationMemberRole; // Alias for backward compatibility
export type UserType = "personal" | "business"; // Simple user type classification
export type OrganizationType = Infer<typeof organizationTypeTuple>;

// Re-export status and role types
export type {
	OrganizationMemberRole,
	OrganizationMemberStatus,
	OrganizationRoleType,
	OrganizationStatus,
	UserStatus,
};

// Re-export document types
export type { DocumentPermissionLevel, DocumentSharingMode, DocumentStatus };
export type { RecipientRole, DocumentRecipientStatus };
export type { ReminderStatus, ReminderType };
export type { DocumentWorkflowStatus } from "./schemas/document_workflow_status";

// Re-export signature workflow types
export type {
	AuthenticationMethod,
	FieldType,
	SignatureType,
	WorkflowRecipientStatus,
};

// Re-export template types
export type { TemplateStatus };

// Re-export email types
export type { EmailStatus, EmailType };

// Re-export audit types
export type { AuditAction, AuditResourceType };

// Re-export notification types
export type { NotificationType };

// Re-export integration types
export type { ApiKeyScope };

// Re-export webhook types
export type { WebhookDeliveryStatus, WebhookEndpointStatus, WebhookEventType };

export default defineSchema({
	users: usersTable,
	user_profiles: userProfilesTable,
	organizations: organizationsTable,
	organization_members: organizationMembersTable,
	organization_invitations: organizationInvitationsTable,
	organization_roles: organizationRolesTable,

	documents: documentsTable,
	document_access: documentAccessTable,
	document_recipients: documentRecipientsTable,
	document_reminders: documentRemindersTable,

	// Signature workflow tables
	recipients: recipientsTable,
	signature_fields: signatureFieldsTable,
	signatures: signaturesTable,
	saved_signatures: savedSignaturesTable,

	// Audit and compliance
	audit_logs: auditLogsTable,

	// Email tracking
	email_logs: emailLogsTable,

	// Notifications
	notifications: notificationsTable,

	subscriptions: subscriptionsTable,
	subscription_products: subscriptionProductsTable,
	subscription_prices: subscriptionPricesTable,

	// Integrations
	api_keys: apiKeysTable,
	connected_apps: connectedAppsTable,
	integration_activity_logs: integrationActivityLogsTable,

	// Templates
	templates: templatesTable,
	template_fields: templateFieldsTable,

	// Webhooks
	webhook_endpoints: webhookEndpoints,
	webhook_deliveries: webhookDeliveries,
});
