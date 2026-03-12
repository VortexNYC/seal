import { defineSchema } from "convex/server";
import type { Infer } from "convex/values";

import {
  aiDocumentAnnotationsTable,
  type AnnotationCategory,
  type AnnotationSeverity,
} from "./schemas/ai_document_annotations";
import { aiFieldSuggestionsTable } from "./schemas/ai_field_suggestions";
import { aiProgressTable } from "./schemas/ai_progress";
import { aiThreadsTable } from "./schemas/ai_threads";
import { aiUsageLogTable } from "./schemas/ai_usage_log";
import { connectedAppsTable, integrationActivityLogsTable } from "./schemas/api_keys";
import { type AuditAction, type AuditResourceType, auditLogsTable } from "./schemas/audit_logs";
import { type ContactStatus, contactsTable } from "./schemas/contacts";
import { dataExportsTable } from "./schemas/data_exports";
import { type DocumentPermissionLevel, documentAccessTable } from "./schemas/document_access";
import { documentInvoicesTable } from "./schemas/document_invoices";
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
import { type DocumentVersionChangeType, documentVersionsTable } from "./schemas/document_versions";
import {
  type DocumentSharingMode,
  type DocumentStatus,
  type SigningMode,
  documentsTable,
} from "./schemas/documents";
import { downloadTokensTable } from "./schemas/download_tokens";
import { feedbackTable } from "./schemas/feedback";
import { foldersTable, type FolderType, type FolderVisibility } from "./schemas/folders";
import {
  mcpOauthClientsTable,
  mcpOauthCodesTable,
  mcpOauthRefreshTokensTable,
} from "./schemas/mcp_oauth";
import { type NotificationType, notificationsTable } from "./schemas/notifications";
import { organizationInvitationsTable } from "./schemas/organization_invitations";
import {
  type OrganizationMemberRole,
  type OrganizationMemberStatus,
  organizationMembersTable,
} from "./schemas/organization_members";
import { type OrganizationRoleType, organizationRolesTable } from "./schemas/organization_roles";
import {
  type BrandingSettings,
  type OrganizationStatus,
  organizationsTable,
  type organizationTypeTuple,
} from "./schemas/organizations";
import {
  type DueDateTerms,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentType,
  paymentFieldConfigsTable,
} from "./schemas/payment_field_configs";
import {
  type AuthenticationMethod,
  recipientsTable,
  type RecipientStatus as WorkflowRecipientStatus,
} from "./schemas/recipients";
import { type SignatureType, savedSignaturesTable } from "./schemas/saved_signatures";
import { type FieldType, signatureFieldsTable } from "./schemas/signature_fields";
import { signaturesTable } from "./schemas/signatures";
import {
  type StripeAccountType,
  type StripeFeeHandling,
  stripeAccountsTable,
} from "./schemas/stripe_accounts";
import { stripeWebhookEventsTable } from "./schemas/stripe_webhook_events";
import {
  type SubscriptionCouponDuration,
  type SubscriptionCouponType,
  subscriptionCouponsTable,
} from "./schemas/subscription_coupons";
import { subscriptionPricesTable } from "./schemas/subscription_prices";
import { subscriptionProductsTable } from "./schemas/subscription_products";
import {
  type SubscriptionPromoCodeStatus,
  subscriptionPromoCodesTable,
} from "./schemas/subscription_promo_codes";
import { subscriptionsTable } from "./schemas/subscriptions";
import { type TemplateStatus, templateFieldsTable, templatesTable } from "./schemas/templates";
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
export type {
  DocumentPermissionLevel,
  DocumentSharingMode,
  DocumentStatus,
  DocumentVersionChangeType,
};
export type { RecipientRole, DocumentRecipientStatus, SigningMode };
export type { ReminderStatus, ReminderType };
export type { DocumentWorkflowStatus } from "./schemas/document_workflow_status";

// Re-export signature workflow types
export type { AuthenticationMethod, FieldType, SignatureType, WorkflowRecipientStatus };

// Re-export template types
export type { TemplateStatus };

// Re-export folder types
export type { FolderType, FolderVisibility };

// Re-export contact types
export type { ContactStatus };

// Re-export audit types
export type { AuditAction, AuditResourceType };

// Re-export notification types
export type { NotificationType };

// Re-export webhook types
export type { WebhookDeliveryStatus, WebhookEndpointStatus, WebhookEventType };

// Re-export Stripe Connect types
export type { StripeAccountType, StripeFeeHandling };

// Re-export subscription coupon/promo types
export type { SubscriptionCouponDuration, SubscriptionCouponType, SubscriptionPromoCodeStatus };

// Re-export payment field config types
export type { DueDateTerms, PaymentMethod, PaymentStatus, PaymentType };

// Re-export AI annotation types
export type { AnnotationCategory, AnnotationSeverity };

// Re-export branding types
export type { BrandingSettings };

export default defineSchema({
  users: usersTable,
  user_profiles: userProfilesTable,
  organizations: organizationsTable,
  organization_members: organizationMembersTable,
  organization_invitations: organizationInvitationsTable,
  organization_roles: organizationRolesTable,

  documents: documentsTable,
  document_versions: documentVersionsTable,
  document_invoices: documentInvoicesTable,
  document_access: documentAccessTable,
  document_recipients: documentRecipientsTable,
  document_reminders: documentRemindersTable,
  folders: foldersTable,

  // Signature workflow tables
  recipients: recipientsTable,
  signature_fields: signatureFieldsTable,
  signatures: signaturesTable,
  saved_signatures: savedSignaturesTable,
  payment_field_configs: paymentFieldConfigsTable,

  // Audit and compliance
  audit_logs: auditLogsTable,
  download_tokens: downloadTokensTable,

  // Notifications
  notifications: notificationsTable,

  subscriptions: subscriptionsTable,
  subscription_products: subscriptionProductsTable,
  subscription_prices: subscriptionPricesTable,
  subscription_coupons: subscriptionCouponsTable,
  subscription_promo_codes: subscriptionPromoCodesTable,
  stripe_accounts: stripeAccountsTable,
  stripe_webhook_events: stripeWebhookEventsTable,

  // Integrations
  connected_apps: connectedAppsTable,
  integration_activity_logs: integrationActivityLogsTable,

  // Templates
  templates: templatesTable,
  template_fields: templateFieldsTable,

  // Contacts
  contacts: contactsTable,

  // Webhooks
  webhook_endpoints: webhookEndpoints,
  webhook_deliveries: webhookDeliveries,

  // Feedback
  feedback: feedbackTable,

  // Data exports (GDPR/CCPA compliance)
  data_exports: dataExportsTable,

  // AI
  ai_field_suggestions: aiFieldSuggestionsTable,
  ai_document_annotations: aiDocumentAnnotationsTable,
  ai_threads: aiThreadsTable,
  ai_progress: aiProgressTable,
  ai_usage_log: aiUsageLogTable,

  // MCP OAuth
  mcp_oauth_clients: mcpOauthClientsTable,
  mcp_oauth_codes: mcpOauthCodesTable,
  mcp_oauth_refresh_tokens: mcpOauthRefreshTokensTable,
});
