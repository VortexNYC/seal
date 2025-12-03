/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit_logs_helpers from "../audit_logs/helpers.js";
import type * as auth from "../auth.js";
import type * as auth_guards from "../auth/guards.js";
import type * as auth_permissions from "../auth/permissions.js";
import type * as auth_wrappers from "../auth/wrappers.js";
import type * as check_membership from "../check_membership.js";
import type * as crons from "../crons.js";
import type * as documents_cleanup from "../documents/cleanup.js";
import type * as documents_email from "../documents/email.js";
import type * as documents_generate_fillable_pdf from "../documents/generate_fillable_pdf.js";
import type * as documents_mutations from "../documents/mutations.js";
import type * as documents_pdf_form_generator from "../documents/pdf_form_generator.js";
import type * as documents_queries from "../documents/queries.js";
import type * as documents_recipient_email_action from "../documents/recipient_email_action.js";
import type * as documents_recipient_helpers from "../documents/recipient_helpers.js";
import type * as documents_recipients_mutations from "../documents/recipients_mutations.js";
import type * as documents_recipients_queries from "../documents/recipients_queries.js";
import type * as documents_reminder_email_action from "../documents/reminder_email_action.js";
import type * as documents_reminders from "../documents/reminders.js";
import type * as documents_reminders_queries from "../documents/reminders_queries.js";
import type * as documents_send_document_action from "../documents/send_document_action.js";
import type * as documents_sharing from "../documents/sharing.js";
import type * as documents_upload_config from "../documents/upload_config.js";
import type * as documents_workflow_helpers from "../documents/workflow_helpers.js";
import type * as documents_workflow_mutations from "../documents/workflow_mutations.js";
import type * as emails_email_logs from "../emails/email_logs.js";
import type * as emails_email_retry from "../emails/email_retry.js";
import type * as emails_user_email_actions from "../emails/user_email_actions.js";
import type * as http from "../http.js";
import type * as organization_roles_helpers from "../organization_roles/helpers.js";
import type * as organization_roles_migrations from "../organization_roles/migrations.js";
import type * as organization_roles_mutations from "../organization_roles/mutations.js";
import type * as organization_roles_queries from "../organization_roles/queries.js";
import type * as organizations_actions from "../organizations/actions.js";
import type * as organizations_helpers from "../organizations/helpers.js";
import type * as organizations_mutations from "../organizations/mutations.js";
import type * as organizations_queries from "../organizations/queries.js";
import type * as schemas_audit_logs from "../schemas/audit_logs.js";
import type * as schemas_document_access from "../schemas/document_access.js";
import type * as schemas_document_recipients from "../schemas/document_recipients.js";
import type * as schemas_document_reminders from "../schemas/document_reminders.js";
import type * as schemas_document_workflow_status from "../schemas/document_workflow_status.js";
import type * as schemas_documents from "../schemas/documents.js";
import type * as schemas_email_logs from "../schemas/email_logs.js";
import type * as schemas_organization_invitations from "../schemas/organization_invitations.js";
import type * as schemas_organization_members from "../schemas/organization_members.js";
import type * as schemas_organization_roles from "../schemas/organization_roles.js";
import type * as schemas_organizations from "../schemas/organizations.js";
import type * as schemas_recipients from "../schemas/recipients.js";
import type * as schemas_signature_fields from "../schemas/signature_fields.js";
import type * as schemas_signatures from "../schemas/signatures.js";
import type * as schemas_subscription_prices from "../schemas/subscription_prices.js";
import type * as schemas_subscription_products from "../schemas/subscription_products.js";
import type * as schemas_subscriptions from "../schemas/subscriptions.js";
import type * as schemas_user_profiles from "../schemas/user_profiles.js";
import type * as schemas_users from "../schemas/users.js";
import type * as signature_fields_helpers from "../signature_fields/helpers.js";
import type * as signature_fields_mutations from "../signature_fields/mutations.js";
import type * as signature_fields_queries from "../signature_fields/queries.js";
import type * as signatures_helpers from "../signatures/helpers.js";
import type * as signatures_mutations from "../signatures/mutations.js";
import type * as signatures_queries from "../signatures/queries.js";
import type * as stripe_handlers from "../stripe/handlers.js";
import type * as stripe_helpers from "../stripe/helpers.js";
import type * as stripe_sync from "../stripe/sync.js";
import type * as stripe_sync_helpers from "../stripe/sync_helpers.js";
import type * as stripe_webhook_handlers from "../stripe/webhook_handlers.js";
import type * as user_profiles_mutations from "../user_profiles/mutations.js";
import type * as user_profiles_queries from "../user_profiles/queries.js";
import type * as validations_organizations from "../validations/organizations.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "audit_logs/helpers": typeof audit_logs_helpers;
  auth: typeof auth;
  "auth/guards": typeof auth_guards;
  "auth/permissions": typeof auth_permissions;
  "auth/wrappers": typeof auth_wrappers;
  check_membership: typeof check_membership;
  crons: typeof crons;
  "documents/cleanup": typeof documents_cleanup;
  "documents/email": typeof documents_email;
  "documents/generate_fillable_pdf": typeof documents_generate_fillable_pdf;
  "documents/mutations": typeof documents_mutations;
  "documents/pdf_form_generator": typeof documents_pdf_form_generator;
  "documents/queries": typeof documents_queries;
  "documents/recipient_email_action": typeof documents_recipient_email_action;
  "documents/recipient_helpers": typeof documents_recipient_helpers;
  "documents/recipients_mutations": typeof documents_recipients_mutations;
  "documents/recipients_queries": typeof documents_recipients_queries;
  "documents/reminder_email_action": typeof documents_reminder_email_action;
  "documents/reminders": typeof documents_reminders;
  "documents/reminders_queries": typeof documents_reminders_queries;
  "documents/send_document_action": typeof documents_send_document_action;
  "documents/sharing": typeof documents_sharing;
  "documents/upload_config": typeof documents_upload_config;
  "documents/workflow_helpers": typeof documents_workflow_helpers;
  "documents/workflow_mutations": typeof documents_workflow_mutations;
  "emails/email_logs": typeof emails_email_logs;
  "emails/email_retry": typeof emails_email_retry;
  "emails/user_email_actions": typeof emails_user_email_actions;
  http: typeof http;
  "organization_roles/helpers": typeof organization_roles_helpers;
  "organization_roles/migrations": typeof organization_roles_migrations;
  "organization_roles/mutations": typeof organization_roles_mutations;
  "organization_roles/queries": typeof organization_roles_queries;
  "organizations/actions": typeof organizations_actions;
  "organizations/helpers": typeof organizations_helpers;
  "organizations/mutations": typeof organizations_mutations;
  "organizations/queries": typeof organizations_queries;
  "schemas/audit_logs": typeof schemas_audit_logs;
  "schemas/document_access": typeof schemas_document_access;
  "schemas/document_recipients": typeof schemas_document_recipients;
  "schemas/document_reminders": typeof schemas_document_reminders;
  "schemas/document_workflow_status": typeof schemas_document_workflow_status;
  "schemas/documents": typeof schemas_documents;
  "schemas/email_logs": typeof schemas_email_logs;
  "schemas/organization_invitations": typeof schemas_organization_invitations;
  "schemas/organization_members": typeof schemas_organization_members;
  "schemas/organization_roles": typeof schemas_organization_roles;
  "schemas/organizations": typeof schemas_organizations;
  "schemas/recipients": typeof schemas_recipients;
  "schemas/signature_fields": typeof schemas_signature_fields;
  "schemas/signatures": typeof schemas_signatures;
  "schemas/subscription_prices": typeof schemas_subscription_prices;
  "schemas/subscription_products": typeof schemas_subscription_products;
  "schemas/subscriptions": typeof schemas_subscriptions;
  "schemas/user_profiles": typeof schemas_user_profiles;
  "schemas/users": typeof schemas_users;
  "signature_fields/helpers": typeof signature_fields_helpers;
  "signature_fields/mutations": typeof signature_fields_mutations;
  "signature_fields/queries": typeof signature_fields_queries;
  "signatures/helpers": typeof signatures_helpers;
  "signatures/mutations": typeof signatures_mutations;
  "signatures/queries": typeof signatures_queries;
  "stripe/handlers": typeof stripe_handlers;
  "stripe/helpers": typeof stripe_helpers;
  "stripe/sync": typeof stripe_sync;
  "stripe/sync_helpers": typeof stripe_sync_helpers;
  "stripe/webhook_handlers": typeof stripe_webhook_handlers;
  "user_profiles/mutations": typeof user_profiles_mutations;
  "user_profiles/queries": typeof user_profiles_queries;
  "validations/organizations": typeof validations_organizations;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
