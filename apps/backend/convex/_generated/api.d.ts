/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as api_context from "../api/context.js";
import type * as api_errors from "../api/errors.js";
import type * as api_helpers from "../api/helpers.js";
import type * as api_index from "../api/index.js";
import type * as api_middleware from "../api/middleware.js";
import type * as api_rate_limit from "../api/rate_limit.js";
import type * as api_rate_limit_mutations from "../api/rate_limit_mutations.js";
import type * as api_v1_documents from "../api/v1/documents.js";
import type * as api_v1_index from "../api/v1/index.js";
import type * as api_v1_recipients from "../api/v1/recipients.js";
import type * as api_v1_signatures from "../api/v1/signatures.js";
import type * as api_v1_templates from "../api/v1/templates.js";
import type * as api_v1_uploads from "../api/v1/uploads.js";
import type * as api_v1_webhooks from "../api/v1/webhooks.js";
import type * as api_versioning from "../api/versioning.js";
import type * as api_keys_actions from "../api_keys/actions.js";
import type * as api_keys_index from "../api_keys/index.js";
import type * as api_keys_mutations from "../api_keys/mutations.js";
import type * as api_keys_queries from "../api_keys/queries.js";
import type * as audit_logs_helpers from "../audit_logs/helpers.js";
import type * as audit_logs_index from "../audit_logs/index.js";
import type * as audit_logs_queries from "../audit_logs/queries.js";
import type * as auth from "../auth.js";
import type * as auth_access_control from "../auth/access_control.js";
import type * as auth_guards from "../auth/guards.js";
import type * as auth_permissions from "../auth/permissions.js";
import type * as auth_recipient_wrappers from "../auth/recipient_wrappers.js";
import type * as auth_subscription_guards from "../auth/subscription_guards.js";
import type * as auth_subscription_helpers from "../auth/subscription_helpers.js";
import type * as auth_wrappers from "../auth/wrappers.js";
import type * as check_membership from "../check_membership.js";
import type * as clerk_webhooks from "../clerk_webhooks.js";
import type * as crons from "../crons.js";
import type * as crypto_helpers from "../crypto/helpers.js";
import type * as crypto_index from "../crypto/index.js";
import type * as crypto_node_helpers from "../crypto/node_helpers.js";
import type * as dashboard_index from "../dashboard/index.js";
import type * as dashboard_queries from "../dashboard/queries.js";
import type * as documents_activity_queries from "../documents/activity_queries.js";
import type * as documents_cleanup from "../documents/cleanup.js";
import type * as documents_document_shared_action from "../documents/document_shared_action.js";
import type * as documents_email from "../documents/email.js";
import type * as documents_generate_fillable_pdf from "../documents/generate_fillable_pdf.js";
import type * as documents_hash_document_action from "../documents/hash_document_action.js";
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
import type * as documents_sharing_cleanup from "../documents/sharing_cleanup.js";
import type * as documents_sign_pdf_action from "../documents/sign_pdf_action.js";
import type * as documents_upload_config from "../documents/upload_config.js";
import type * as documents_workflow_helpers from "../documents/workflow_helpers.js";
import type * as documents_workflow_mutations from "../documents/workflow_mutations.js";
import type * as emails_email_logs from "../emails/email_logs.js";
import type * as emails_email_retry from "../emails/email_retry.js";
import type * as emails_user_email_actions from "../emails/user_email_actions.js";
import type * as fix_user_org from "../fix_user_org.js";
import type * as http from "../http.js";
import type * as mcp_oauth_http from "../mcp_oauth/http.js";
import type * as mcp_oauth_mutations from "../mcp_oauth/mutations.js";
import type * as mcp_oauth_queries from "../mcp_oauth/queries.js";
import type * as notifications_index from "../notifications/index.js";
import type * as organization_roles_helpers from "../organization_roles/helpers.js";
import type * as organization_roles_migrations from "../organization_roles/migrations.js";
import type * as organization_roles_mutations from "../organization_roles/mutations.js";
import type * as organization_roles_queries from "../organization_roles/queries.js";
import type * as organizations_actions from "../organizations/actions.js";
import type * as organizations_helpers from "../organizations/helpers.js";
import type * as organizations_mutations from "../organizations/mutations.js";
import type * as organizations_queries from "../organizations/queries.js";
import type * as payment_fields_helpers from "../payment_fields/helpers.js";
import type * as payment_fields_mutations from "../payment_fields/mutations.js";
import type * as payment_fields_queries from "../payment_fields/queries.js";
import type * as rls from "../rls.js";
import type * as saved_signatures_index from "../saved_signatures/index.js";
import type * as saved_signatures_mutations from "../saved_signatures/mutations.js";
import type * as saved_signatures_queries from "../saved_signatures/queries.js";
import type * as schemas_api_keys from "../schemas/api_keys.js";
import type * as schemas_audit_logs from "../schemas/audit_logs.js";
import type * as schemas_document_access from "../schemas/document_access.js";
import type * as schemas_document_invoices from "../schemas/document_invoices.js";
import type * as schemas_document_recipients from "../schemas/document_recipients.js";
import type * as schemas_document_reminders from "../schemas/document_reminders.js";
import type * as schemas_document_workflow_status from "../schemas/document_workflow_status.js";
import type * as schemas_documents from "../schemas/documents.js";
import type * as schemas_email_logs from "../schemas/email_logs.js";
import type * as schemas_mcp_oauth from "../schemas/mcp_oauth.js";
import type * as schemas_notifications from "../schemas/notifications.js";
import type * as schemas_organization_invitations from "../schemas/organization_invitations.js";
import type * as schemas_organization_members from "../schemas/organization_members.js";
import type * as schemas_organization_roles from "../schemas/organization_roles.js";
import type * as schemas_organizations from "../schemas/organizations.js";
import type * as schemas_payment_field_configs from "../schemas/payment_field_configs.js";
import type * as schemas_rate_limits from "../schemas/rate_limits.js";
import type * as schemas_recipients from "../schemas/recipients.js";
import type * as schemas_saved_signatures from "../schemas/saved_signatures.js";
import type * as schemas_signature_fields from "../schemas/signature_fields.js";
import type * as schemas_signatures from "../schemas/signatures.js";
import type * as schemas_stripe_accounts from "../schemas/stripe_accounts.js";
import type * as schemas_stripe_webhook_events from "../schemas/stripe_webhook_events.js";
import type * as schemas_subscription_coupons from "../schemas/subscription_coupons.js";
import type * as schemas_subscription_prices from "../schemas/subscription_prices.js";
import type * as schemas_subscription_products from "../schemas/subscription_products.js";
import type * as schemas_subscription_promo_codes from "../schemas/subscription_promo_codes.js";
import type * as schemas_subscriptions from "../schemas/subscriptions.js";
import type * as schemas_templates from "../schemas/templates.js";
import type * as schemas_user_profiles from "../schemas/user_profiles.js";
import type * as schemas_users from "../schemas/users.js";
import type * as schemas_webhooks from "../schemas/webhooks.js";
import type * as signature_fields_helpers from "../signature_fields/helpers.js";
import type * as signature_fields_mutations from "../signature_fields/mutations.js";
import type * as signature_fields_queries from "../signature_fields/queries.js";
import type * as signatures_helpers from "../signatures/helpers.js";
import type * as signatures_mutations from "../signatures/mutations.js";
import type * as signatures_queries from "../signatures/queries.js";
import type * as stripe_actions from "../stripe/actions.js";
import type * as stripe_backfill_subscriptions from "../stripe/backfill_subscriptions.js";
import type * as stripe_connect_actions from "../stripe/connect_actions.js";
import type * as stripe_connect_helpers from "../stripe/connect_helpers.js";
import type * as stripe_connect_mutations from "../stripe/connect_mutations.js";
import type * as stripe_connect_public_mutations from "../stripe/connect_public_mutations.js";
import type * as stripe_connect_queries from "../stripe/connect_queries.js";
import type * as stripe_connect_webhook_handlers from "../stripe/connect_webhook_handlers.js";
import type * as stripe_coupon from "../stripe/coupon.js";
import type * as stripe_handlers from "../stripe/handlers.js";
import type * as stripe_helpers from "../stripe/helpers.js";
import type * as stripe_invoice_actions from "../stripe/invoice_actions.js";
import type * as stripe_invoice_mutations from "../stripe/invoice_mutations.js";
import type * as stripe_payment_field_actions from "../stripe/payment_field_actions.js";
import type * as stripe_invoice_queries from "../stripe/invoice_queries.js";
import type * as stripe_pricing from "../stripe/pricing.js";
import type * as stripe_promo_code from "../stripe/promo_code.js";
import type * as stripe_queries from "../stripe/queries.js";
import type * as stripe_subscription_actions from "../stripe/subscription_actions.js";
import type * as stripe_sync from "../stripe/sync.js";
import type * as stripe_sync_helpers from "../stripe/sync_helpers.js";
import type * as stripe_sync_subscriptions from "../stripe/sync_subscriptions.js";
import type * as stripe_webhook_handlers from "../stripe/webhook_handlers.js";
import type * as stripe_webhook_idempotency from "../stripe/webhook_idempotency.js";
import type * as sync_external_data from "../sync_external_data.js";
import type * as templates_index from "../templates/index.js";
import type * as templates_mutations from "../templates/mutations.js";
import type * as templates_queries from "../templates/queries.js";
import type * as user_profiles_mutations from "../user_profiles/mutations.js";
import type * as user_profiles_queries from "../user_profiles/queries.js";
import type * as validations_api from "../validations/api.js";
import type * as validations_organizations from "../validations/organizations.js";
import type * as webhooks_index from "../webhooks/index.js";
import type * as webhooks_mutations from "../webhooks/mutations.js";
import type * as webhooks_queries from "../webhooks/queries.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "api/context": typeof api_context;
  "api/errors": typeof api_errors;
  "api/helpers": typeof api_helpers;
  "api/index": typeof api_index;
  "api/middleware": typeof api_middleware;
  "api/rate_limit": typeof api_rate_limit;
  "api/rate_limit_mutations": typeof api_rate_limit_mutations;
  "api/v1/documents": typeof api_v1_documents;
  "api/v1/index": typeof api_v1_index;
  "api/v1/recipients": typeof api_v1_recipients;
  "api/v1/signatures": typeof api_v1_signatures;
  "api/v1/templates": typeof api_v1_templates;
  "api/v1/uploads": typeof api_v1_uploads;
  "api/v1/webhooks": typeof api_v1_webhooks;
  "api/versioning": typeof api_versioning;
  "api_keys/actions": typeof api_keys_actions;
  "api_keys/index": typeof api_keys_index;
  "api_keys/mutations": typeof api_keys_mutations;
  "api_keys/queries": typeof api_keys_queries;
  "audit_logs/helpers": typeof audit_logs_helpers;
  "audit_logs/index": typeof audit_logs_index;
  "audit_logs/queries": typeof audit_logs_queries;
  auth: typeof auth;
  "auth/access_control": typeof auth_access_control;
  "auth/guards": typeof auth_guards;
  "auth/permissions": typeof auth_permissions;
  "auth/recipient_wrappers": typeof auth_recipient_wrappers;
  "auth/subscription_guards": typeof auth_subscription_guards;
  "auth/subscription_helpers": typeof auth_subscription_helpers;
  "auth/wrappers": typeof auth_wrappers;
  check_membership: typeof check_membership;
  clerk_webhooks: typeof clerk_webhooks;
  crons: typeof crons;
  "crypto/helpers": typeof crypto_helpers;
  "crypto/index": typeof crypto_index;
  "crypto/node_helpers": typeof crypto_node_helpers;
  "dashboard/index": typeof dashboard_index;
  "dashboard/queries": typeof dashboard_queries;
  "documents/activity_queries": typeof documents_activity_queries;
  "documents/cleanup": typeof documents_cleanup;
  "documents/document_shared_action": typeof documents_document_shared_action;
  "documents/email": typeof documents_email;
  "documents/generate_fillable_pdf": typeof documents_generate_fillable_pdf;
  "documents/hash_document_action": typeof documents_hash_document_action;
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
  "documents/sharing_cleanup": typeof documents_sharing_cleanup;
  "documents/sign_pdf_action": typeof documents_sign_pdf_action;
  "documents/upload_config": typeof documents_upload_config;
  "documents/workflow_helpers": typeof documents_workflow_helpers;
  "documents/workflow_mutations": typeof documents_workflow_mutations;
  "emails/email_logs": typeof emails_email_logs;
  "emails/email_retry": typeof emails_email_retry;
  "emails/user_email_actions": typeof emails_user_email_actions;
  fix_user_org: typeof fix_user_org;
  http: typeof http;
  "mcp_oauth/http": typeof mcp_oauth_http;
  "mcp_oauth/mutations": typeof mcp_oauth_mutations;
  "mcp_oauth/queries": typeof mcp_oauth_queries;
  "notifications/index": typeof notifications_index;
  "organization_roles/helpers": typeof organization_roles_helpers;
  "organization_roles/migrations": typeof organization_roles_migrations;
  "organization_roles/mutations": typeof organization_roles_mutations;
  "organization_roles/queries": typeof organization_roles_queries;
  "organizations/actions": typeof organizations_actions;
  "organizations/helpers": typeof organizations_helpers;
  "organizations/mutations": typeof organizations_mutations;
  "organizations/queries": typeof organizations_queries;
  "payment_fields/helpers": typeof payment_fields_helpers;
  "payment_fields/mutations": typeof payment_fields_mutations;
  "payment_fields/queries": typeof payment_fields_queries;
  rls: typeof rls;
  "saved_signatures/index": typeof saved_signatures_index;
  "saved_signatures/mutations": typeof saved_signatures_mutations;
  "saved_signatures/queries": typeof saved_signatures_queries;
  "schemas/api_keys": typeof schemas_api_keys;
  "schemas/audit_logs": typeof schemas_audit_logs;
  "schemas/document_access": typeof schemas_document_access;
  "schemas/document_invoices": typeof schemas_document_invoices;
  "schemas/document_recipients": typeof schemas_document_recipients;
  "schemas/document_reminders": typeof schemas_document_reminders;
  "schemas/document_workflow_status": typeof schemas_document_workflow_status;
  "schemas/documents": typeof schemas_documents;
  "schemas/email_logs": typeof schemas_email_logs;
  "schemas/mcp_oauth": typeof schemas_mcp_oauth;
  "schemas/notifications": typeof schemas_notifications;
  "schemas/organization_invitations": typeof schemas_organization_invitations;
  "schemas/organization_members": typeof schemas_organization_members;
  "schemas/organization_roles": typeof schemas_organization_roles;
  "schemas/organizations": typeof schemas_organizations;
  "schemas/payment_field_configs": typeof schemas_payment_field_configs;
  "schemas/rate_limits": typeof schemas_rate_limits;
  "schemas/recipients": typeof schemas_recipients;
  "schemas/saved_signatures": typeof schemas_saved_signatures;
  "schemas/signature_fields": typeof schemas_signature_fields;
  "schemas/signatures": typeof schemas_signatures;
  "schemas/stripe_accounts": typeof schemas_stripe_accounts;
  "schemas/stripe_webhook_events": typeof schemas_stripe_webhook_events;
  "schemas/subscription_coupons": typeof schemas_subscription_coupons;
  "schemas/subscription_prices": typeof schemas_subscription_prices;
  "schemas/subscription_products": typeof schemas_subscription_products;
  "schemas/subscription_promo_codes": typeof schemas_subscription_promo_codes;
  "schemas/subscriptions": typeof schemas_subscriptions;
  "schemas/templates": typeof schemas_templates;
  "schemas/user_profiles": typeof schemas_user_profiles;
  "schemas/users": typeof schemas_users;
  "schemas/webhooks": typeof schemas_webhooks;
  "signature_fields/helpers": typeof signature_fields_helpers;
  "signature_fields/mutations": typeof signature_fields_mutations;
  "signature_fields/queries": typeof signature_fields_queries;
  "signatures/helpers": typeof signatures_helpers;
  "signatures/mutations": typeof signatures_mutations;
  "signatures/queries": typeof signatures_queries;
  "stripe/actions": typeof stripe_actions;
  "stripe/backfill_subscriptions": typeof stripe_backfill_subscriptions;
  "stripe/connect_actions": typeof stripe_connect_actions;
  "stripe/connect_helpers": typeof stripe_connect_helpers;
  "stripe/connect_mutations": typeof stripe_connect_mutations;
  "stripe/connect_public_mutations": typeof stripe_connect_public_mutations;
  "stripe/connect_queries": typeof stripe_connect_queries;
  "stripe/connect_webhook_handlers": typeof stripe_connect_webhook_handlers;
  "stripe/coupon": typeof stripe_coupon;
  "stripe/handlers": typeof stripe_handlers;
  "stripe/helpers": typeof stripe_helpers;
  "stripe/invoice_actions": typeof stripe_invoice_actions;
  "stripe/invoice_mutations": typeof stripe_invoice_mutations;
  "stripe/payment_field_actions": typeof stripe_payment_field_actions;
  "stripe/invoice_queries": typeof stripe_invoice_queries;
  "stripe/pricing": typeof stripe_pricing;
  "stripe/promo_code": typeof stripe_promo_code;
  "stripe/queries": typeof stripe_queries;
  "stripe/subscription_actions": typeof stripe_subscription_actions;
  "stripe/sync": typeof stripe_sync;
  "stripe/sync_helpers": typeof stripe_sync_helpers;
  "stripe/sync_subscriptions": typeof stripe_sync_subscriptions;
  "stripe/webhook_handlers": typeof stripe_webhook_handlers;
  "stripe/webhook_idempotency": typeof stripe_webhook_idempotency;
  sync_external_data: typeof sync_external_data;
  "templates/index": typeof templates_index;
  "templates/mutations": typeof templates_mutations;
  "templates/queries": typeof templates_queries;
  "user_profiles/mutations": typeof user_profiles_mutations;
  "user_profiles/queries": typeof user_profiles_queries;
  "validations/api": typeof validations_api;
  "validations/organizations": typeof validations_organizations;
  "webhooks/index": typeof webhooks_index;
  "webhooks/mutations": typeof webhooks_mutations;
  "webhooks/queries": typeof webhooks_queries;
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
