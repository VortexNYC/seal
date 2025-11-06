import { defineSchema } from "convex/server";
import type { Infer } from "convex/values";
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
	documentRecipientsTable,
	type RecipientRole,
	type RecipientStatus,
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
	type RecipientStatus,
	recipientsTable,
} from "./schemas/recipients";
import {
	type FieldType,
	signatureFieldsTable,
} from "./schemas/signature_fields";
import { signaturesTable } from "./schemas/signatures";
import { subscriptionPricesTable } from "./schemas/subscription_prices";
import { subscriptionProductsTable } from "./schemas/subscription_products";
import { subscriptionsTable } from "./schemas/subscriptions";
import { type UserStatus, usersTable } from "./schemas/users";

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
export type { RecipientRole, RecipientStatus };
export type { ReminderStatus, ReminderType };
export type { DocumentWorkflowStatus } from "./schemas/document_workflow_status";

// Re-export signature workflow types
export type { AuthenticationMethod, FieldType, RecipientStatus };

// Re-export audit types
export type { AuditAction, AuditResourceType };

export default defineSchema({
	users: usersTable,
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

	// Audit and compliance
	audit_logs: auditLogsTable,

	subscriptions: subscriptionsTable,
	subscription_products: subscriptionProductsTable,
	subscription_prices: subscriptionPricesTable,
});
