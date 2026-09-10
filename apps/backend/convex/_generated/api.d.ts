/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai_actions from "../ai/actions.js";
import type * as ai_agent from "../ai/agent.js";
import type * as ai_analyzeFieldsAction from "../ai/analyzeFieldsAction.js";
import type * as ai_analyzeFieldsSchema from "../ai/analyzeFieldsSchema.js";
import type * as ai_cleanup from "../ai/cleanup.js";
import type * as ai_component_ctx from "../ai/component_ctx.js";
import type * as ai_eval from "../ai/eval.js";
import type * as ai_evalExtraction from "../ai/evalExtraction.js";
import type * as ai_eval_helpers from "../ai/eval_helpers.js";
import type * as ai_model from "../ai/model.js";
import type * as ai_mutations from "../ai/mutations.js";
import type * as ai_ocrFallback from "../ai/ocrFallback.js";
import type * as ai_paymentExtraction from "../ai/paymentExtraction.js";
import type * as ai_paymentExtractionAction from "../ai/paymentExtractionAction.js";
import type * as ai_pipeline from "../ai/pipeline.js";
import type * as ai_pipeline_mutations from "../ai/pipeline_mutations.js";
import type * as ai_progress from "../ai/progress.js";
import type * as ai_queries from "../ai/queries.js";
import type * as ai_rateLimiting from "../ai/rateLimiting.js";
import type * as ai_search from "../ai/search.js";
import type * as ai_search_queries from "../ai/search_queries.js";
import type * as ai_threadQueries from "../ai/threadQueries.js";
import type * as ai_threads from "../ai/threads.js";
import type * as ai_tools_analyze_fields from "../ai/tools/analyze_fields.js";
import type * as ai_tools_extract_payment_terms from "../ai/tools/extract_payment_terms.js";
import type * as ai_tools_paymentExtractionSchema from "../ai/tools/paymentExtractionSchema.js";
import type * as ai_tools_search_documents from "../ai/tools/search_documents.js";
import type * as ai_types from "../ai/types.js";
import type * as ai_usage from "../ai/usage.js";
import type * as ai_workpool from "../ai/workpool.js";
import type * as api_context from "../api/context.js";
import type * as api_errors from "../api/errors.js";
import type * as api_helpers from "../api/helpers.js";
import type * as apiAuth from "../apiAuth.js";
import type * as api_keys_keys from "../api_keys/keys.js";
import type * as audit_logs_helpers from "../audit_logs/helpers.js";
import type * as audit_logs_queries from "../audit_logs/queries.js";
import type * as auth from "../auth.js";
import type * as auth_access_control from "../auth/access_control.js";
import type * as auth_permissions from "../auth/permissions.js";
import type * as auth_plan_limits from "../auth/plan_limits.js";
import type * as auth_subscription_guards from "../auth/subscription_guards.js";
import type * as auth_subscription_helpers from "../auth/subscription_helpers.js";
import type * as auth_wrappers from "../auth/wrappers.js";
import type * as betterAuth from "../betterAuth.js";
import type * as betterAuthClient from "../betterAuthClient.js";
import type * as crons from "../crons.js";
import type * as crypto_encryption from "../crypto/encryption.js";
import type * as crypto_helpers from "../crypto/helpers.js";
import type * as documents_automated_reminders from "../documents/automated_reminders.js";
import type * as documents_certificate_of_completion from "../documents/certificate_of_completion.js";
import type * as documents_download_tokens from "../documents/download_tokens.js";
import type * as documents_email from "../documents/email.js";
import type * as documents_expiration_alerts from "../documents/expiration_alerts.js";
import type * as documents_expiration_sweep from "../documents/expiration_sweep.js";
import type * as documents_extract_text_action from "../documents/extract_text_action.js";
import type * as documents_hash_document_action from "../documents/hash_document_action.js";
import type * as documents_mutations from "../documents/mutations.js";
import type * as documents_ownership_transfer_action from "../documents/ownership_transfer_action.js";
import type * as documents_queries from "../documents/queries.js";
import type * as documents_recipient_email_action from "../documents/recipient_email_action.js";
import type * as documents_recipient_helpers from "../documents/recipient_helpers.js";
import type * as documents_recipients_mutations from "../documents/recipients_mutations.js";
import type * as documents_recipients_queries from "../documents/recipients_queries.js";
import type * as documents_reminder_email_action from "../documents/reminder_email_action.js";
import type * as documents_send_document_action from "../documents/send_document_action.js";
import type * as documents_upload_config from "../documents/upload_config.js";
import type * as documents_version_helpers from "../documents/version_helpers.js";
import type * as documents_viewed_notification_action from "../documents/viewed_notification_action.js";
import type * as documents_workflow_helpers from "../documents/workflow_helpers.js";
import type * as emails_resend_component from "../emails/resend_component.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as lib_authIdentities from "../lib/authIdentities.js";
import type * as lib_canonicalGlue from "../lib/canonicalGlue.js";
import type * as lib_componentOrgReads from "../lib/componentOrgReads.js";
import type * as lib_identity from "../lib/identity.js";
import type * as lib_resolveActiveOrganization from "../lib/resolveActiveOrganization.js";
import type * as lib_suiteOrgPolicy from "../lib/suiteOrgPolicy.js";
import type * as lib_vortexAuthApiKeyRotate from "../lib/vortexAuthApiKeyRotate.js";
import type * as lib_vortexAuthOrganizations from "../lib/vortexAuthOrganizations.js";
import type * as mcpOAuth from "../mcpOAuth.js";
import type * as mcpOAuthAuth from "../mcpOAuthAuth.js";
import type * as mcpOAuthAuthorization from "../mcpOAuthAuthorization.js";
import type * as mcpOAuthNode from "../mcpOAuthNode.js";
import type * as organizations_helpers from "../organizations/helpers.js";
import type * as organizations_mutations from "../organizations/mutations.js";
import type * as organizations_queries from "../organizations/queries.js";
import type * as payment_fields_dunning from "../payment_fields/dunning.js";
import type * as payment_fields_dunning_email_action from "../payment_fields/dunning_email_action.js";
import type * as payment_fields_helpers from "../payment_fields/helpers.js";
import type * as payment_fields_mutations from "../payment_fields/mutations.js";
import type * as payment_fields_queries from "../payment_fields/queries.js";
import type * as payments_merchant_account_mutations from "../payments/merchant_account_mutations.js";
import type * as payments_merchant_account_validators from "../payments/merchant_account_validators.js";
import type * as payments_payment_field_actions from "../payments/payment_field_actions.js";
import type * as payments_saas_billing_provider from "../payments/saas_billing_provider.js";
import type * as payments_subscription_actions from "../payments/subscription_actions.js";
import type * as payments_vortex_merchant_actions from "../payments/vortex_merchant_actions.js";
import type * as payments_vortex_merchant_queries from "../payments/vortex_merchant_queries.js";
import type * as retrier from "../retrier.js";
import type * as rls from "../rls.js";
import type * as schemas_ai_document_annotations from "../schemas/ai_document_annotations.js";
import type * as schemas_ai_field_suggestions from "../schemas/ai_field_suggestions.js";
import type * as schemas_ai_progress from "../schemas/ai_progress.js";
import type * as schemas_ai_routing_logs from "../schemas/ai_routing_logs.js";
import type * as schemas_ai_threads from "../schemas/ai_threads.js";
import type * as schemas_ai_usage_log from "../schemas/ai_usage_log.js";
import type * as schemas_api_keys from "../schemas/api_keys.js";
import type * as schemas_audit_logs from "../schemas/audit_logs.js";
import type * as schemas_contacts from "../schemas/contacts.js";
import type * as schemas_data_exports from "../schemas/data_exports.js";
import type * as schemas_document_access from "../schemas/document_access.js";
import type * as schemas_document_invoices from "../schemas/document_invoices.js";
import type * as schemas_document_recipients from "../schemas/document_recipients.js";
import type * as schemas_document_reminders from "../schemas/document_reminders.js";
import type * as schemas_document_versions from "../schemas/document_versions.js";
import type * as schemas_document_workflow_status from "../schemas/document_workflow_status.js";
import type * as schemas_documents from "../schemas/documents.js";
import type * as schemas_download_tokens from "../schemas/download_tokens.js";
import type * as schemas_feedback from "../schemas/feedback.js";
import type * as schemas_folders from "../schemas/folders.js";
import type * as schemas_merchant_accounts from "../schemas/merchant_accounts.js";
import type * as schemas_notifications from "../schemas/notifications.js";
import type * as schemas_organization_invitations from "../schemas/organization_invitations.js";
import type * as schemas_organization_members from "../schemas/organization_members.js";
import type * as schemas_organization_roles from "../schemas/organization_roles.js";
import type * as schemas_organizations from "../schemas/organizations.js";
import type * as schemas_payment_field_configs from "../schemas/payment_field_configs.js";
import type * as schemas_recipients from "../schemas/recipients.js";
import type * as schemas_saved_signatures from "../schemas/saved_signatures.js";
import type * as schemas_signature_fields from "../schemas/signature_fields.js";
import type * as schemas_signatures from "../schemas/signatures.js";
import type * as schemas_subscription_coupons from "../schemas/subscription_coupons.js";
import type * as schemas_subscription_prices from "../schemas/subscription_prices.js";
import type * as schemas_subscription_products from "../schemas/subscription_products.js";
import type * as schemas_subscription_promo_codes from "../schemas/subscription_promo_codes.js";
import type * as schemas_subscriptions from "../schemas/subscriptions.js";
import type * as schemas_templates from "../schemas/templates.js";
import type * as schemas_user_profiles from "../schemas/user_profiles.js";
import type * as schemas_users from "../schemas/users.js";
import type * as schemas_vortex_billing_webhook_events from "../schemas/vortex_billing_webhook_events.js";
import type * as schemas_webhooks from "../schemas/webhooks.js";
import type * as signature_fields_queries from "../signature_fields/queries.js";
import type * as subscription_price_resolver from "../subscription_price_resolver.js";
import type * as testVortexAuth from "../testVortexAuth.js";
import type * as users from "../users.js";
import type * as validations_organizations from "../validations/organizations.js";
import type * as vortex_billing_catalog_mutations from "../vortex_billing/catalog_mutations.js";
import type * as vortex_billing_catalog_queries from "../vortex_billing/catalog_queries.js";
import type * as vortex_billing_catalog_sync from "../vortex_billing/catalog_sync.js";
import type * as vortex_billing_payable_actions from "../vortex_billing/payable_actions.js";
import type * as vortex_billing_projection from "../vortex_billing/projection.js";
import type * as vortex_billing_proof_actions from "../vortex_billing/proof_actions.js";
import type * as vortex_billing_webhook_handlers from "../vortex_billing/webhook_handlers.js";
import type * as vortex_billing_webhook_signature from "../vortex_billing/webhook_signature.js";
import type * as webhooks_delivery from "../webhooks/delivery.js";
import type * as webhooks_mutations from "../webhooks/mutations.js";
import type * as webhooks_publish from "../webhooks/publish.js";
import type * as webhooks_queries from "../webhooks/queries.js";
import type * as webhooks_slack_formatter from "../webhooks/slack_formatter.js";
import type * as webhooks_vortex_surface from "../webhooks/vortex_surface.js";
import type * as workflows_document_completion from "../workflows/document_completion.js";
import type * as workflows_document_completion_steps from "../workflows/document_completion_steps.js";
import type * as workflows_index from "../workflows/index.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "ai/actions": typeof ai_actions;
  "ai/agent": typeof ai_agent;
  "ai/analyzeFieldsAction": typeof ai_analyzeFieldsAction;
  "ai/analyzeFieldsSchema": typeof ai_analyzeFieldsSchema;
  "ai/cleanup": typeof ai_cleanup;
  "ai/component_ctx": typeof ai_component_ctx;
  "ai/eval": typeof ai_eval;
  "ai/evalExtraction": typeof ai_evalExtraction;
  "ai/eval_helpers": typeof ai_eval_helpers;
  "ai/model": typeof ai_model;
  "ai/mutations": typeof ai_mutations;
  "ai/ocrFallback": typeof ai_ocrFallback;
  "ai/paymentExtraction": typeof ai_paymentExtraction;
  "ai/paymentExtractionAction": typeof ai_paymentExtractionAction;
  "ai/pipeline": typeof ai_pipeline;
  "ai/pipeline_mutations": typeof ai_pipeline_mutations;
  "ai/progress": typeof ai_progress;
  "ai/queries": typeof ai_queries;
  "ai/rateLimiting": typeof ai_rateLimiting;
  "ai/search": typeof ai_search;
  "ai/search_queries": typeof ai_search_queries;
  "ai/threadQueries": typeof ai_threadQueries;
  "ai/threads": typeof ai_threads;
  "ai/tools/analyze_fields": typeof ai_tools_analyze_fields;
  "ai/tools/extract_payment_terms": typeof ai_tools_extract_payment_terms;
  "ai/tools/paymentExtractionSchema": typeof ai_tools_paymentExtractionSchema;
  "ai/tools/search_documents": typeof ai_tools_search_documents;
  "ai/types": typeof ai_types;
  "ai/usage": typeof ai_usage;
  "ai/workpool": typeof ai_workpool;
  "api/context": typeof api_context;
  "api/errors": typeof api_errors;
  "api/helpers": typeof api_helpers;
  apiAuth: typeof apiAuth;
  "api_keys/keys": typeof api_keys_keys;
  "audit_logs/helpers": typeof audit_logs_helpers;
  "audit_logs/queries": typeof audit_logs_queries;
  auth: typeof auth;
  "auth/access_control": typeof auth_access_control;
  "auth/permissions": typeof auth_permissions;
  "auth/plan_limits": typeof auth_plan_limits;
  "auth/subscription_guards": typeof auth_subscription_guards;
  "auth/subscription_helpers": typeof auth_subscription_helpers;
  "auth/wrappers": typeof auth_wrappers;
  betterAuth: typeof betterAuth;
  betterAuthClient: typeof betterAuthClient;
  crons: typeof crons;
  "crypto/encryption": typeof crypto_encryption;
  "crypto/helpers": typeof crypto_helpers;
  "documents/automated_reminders": typeof documents_automated_reminders;
  "documents/certificate_of_completion": typeof documents_certificate_of_completion;
  "documents/download_tokens": typeof documents_download_tokens;
  "documents/email": typeof documents_email;
  "documents/expiration_alerts": typeof documents_expiration_alerts;
  "documents/expiration_sweep": typeof documents_expiration_sweep;
  "documents/extract_text_action": typeof documents_extract_text_action;
  "documents/hash_document_action": typeof documents_hash_document_action;
  "documents/mutations": typeof documents_mutations;
  "documents/ownership_transfer_action": typeof documents_ownership_transfer_action;
  "documents/queries": typeof documents_queries;
  "documents/recipient_email_action": typeof documents_recipient_email_action;
  "documents/recipient_helpers": typeof documents_recipient_helpers;
  "documents/recipients_mutations": typeof documents_recipients_mutations;
  "documents/recipients_queries": typeof documents_recipients_queries;
  "documents/reminder_email_action": typeof documents_reminder_email_action;
  "documents/send_document_action": typeof documents_send_document_action;
  "documents/upload_config": typeof documents_upload_config;
  "documents/version_helpers": typeof documents_version_helpers;
  "documents/viewed_notification_action": typeof documents_viewed_notification_action;
  "documents/workflow_helpers": typeof documents_workflow_helpers;
  "emails/resend_component": typeof emails_resend_component;
  http: typeof http;
  invitations: typeof invitations;
  "lib/authIdentities": typeof lib_authIdentities;
  "lib/canonicalGlue": typeof lib_canonicalGlue;
  "lib/componentOrgReads": typeof lib_componentOrgReads;
  "lib/identity": typeof lib_identity;
  "lib/resolveActiveOrganization": typeof lib_resolveActiveOrganization;
  "lib/suiteOrgPolicy": typeof lib_suiteOrgPolicy;
  "lib/vortexAuthApiKeyRotate": typeof lib_vortexAuthApiKeyRotate;
  "lib/vortexAuthOrganizations": typeof lib_vortexAuthOrganizations;
  mcpOAuth: typeof mcpOAuth;
  mcpOAuthAuth: typeof mcpOAuthAuth;
  mcpOAuthAuthorization: typeof mcpOAuthAuthorization;
  mcpOAuthNode: typeof mcpOAuthNode;
  "organizations/helpers": typeof organizations_helpers;
  "organizations/mutations": typeof organizations_mutations;
  "organizations/queries": typeof organizations_queries;
  "payment_fields/dunning": typeof payment_fields_dunning;
  "payment_fields/dunning_email_action": typeof payment_fields_dunning_email_action;
  "payment_fields/helpers": typeof payment_fields_helpers;
  "payment_fields/mutations": typeof payment_fields_mutations;
  "payment_fields/queries": typeof payment_fields_queries;
  "payments/merchant_account_mutations": typeof payments_merchant_account_mutations;
  "payments/merchant_account_validators": typeof payments_merchant_account_validators;
  "payments/payment_field_actions": typeof payments_payment_field_actions;
  "payments/saas_billing_provider": typeof payments_saas_billing_provider;
  "payments/subscription_actions": typeof payments_subscription_actions;
  "payments/vortex_merchant_actions": typeof payments_vortex_merchant_actions;
  "payments/vortex_merchant_queries": typeof payments_vortex_merchant_queries;
  retrier: typeof retrier;
  rls: typeof rls;
  "schemas/ai_document_annotations": typeof schemas_ai_document_annotations;
  "schemas/ai_field_suggestions": typeof schemas_ai_field_suggestions;
  "schemas/ai_progress": typeof schemas_ai_progress;
  "schemas/ai_routing_logs": typeof schemas_ai_routing_logs;
  "schemas/ai_threads": typeof schemas_ai_threads;
  "schemas/ai_usage_log": typeof schemas_ai_usage_log;
  "schemas/api_keys": typeof schemas_api_keys;
  "schemas/audit_logs": typeof schemas_audit_logs;
  "schemas/contacts": typeof schemas_contacts;
  "schemas/data_exports": typeof schemas_data_exports;
  "schemas/document_access": typeof schemas_document_access;
  "schemas/document_invoices": typeof schemas_document_invoices;
  "schemas/document_recipients": typeof schemas_document_recipients;
  "schemas/document_reminders": typeof schemas_document_reminders;
  "schemas/document_versions": typeof schemas_document_versions;
  "schemas/document_workflow_status": typeof schemas_document_workflow_status;
  "schemas/documents": typeof schemas_documents;
  "schemas/download_tokens": typeof schemas_download_tokens;
  "schemas/feedback": typeof schemas_feedback;
  "schemas/folders": typeof schemas_folders;
  "schemas/merchant_accounts": typeof schemas_merchant_accounts;
  "schemas/notifications": typeof schemas_notifications;
  "schemas/organization_invitations": typeof schemas_organization_invitations;
  "schemas/organization_members": typeof schemas_organization_members;
  "schemas/organization_roles": typeof schemas_organization_roles;
  "schemas/organizations": typeof schemas_organizations;
  "schemas/payment_field_configs": typeof schemas_payment_field_configs;
  "schemas/recipients": typeof schemas_recipients;
  "schemas/saved_signatures": typeof schemas_saved_signatures;
  "schemas/signature_fields": typeof schemas_signature_fields;
  "schemas/signatures": typeof schemas_signatures;
  "schemas/subscription_coupons": typeof schemas_subscription_coupons;
  "schemas/subscription_prices": typeof schemas_subscription_prices;
  "schemas/subscription_products": typeof schemas_subscription_products;
  "schemas/subscription_promo_codes": typeof schemas_subscription_promo_codes;
  "schemas/subscriptions": typeof schemas_subscriptions;
  "schemas/templates": typeof schemas_templates;
  "schemas/user_profiles": typeof schemas_user_profiles;
  "schemas/users": typeof schemas_users;
  "schemas/vortex_billing_webhook_events": typeof schemas_vortex_billing_webhook_events;
  "schemas/webhooks": typeof schemas_webhooks;
  "signature_fields/queries": typeof signature_fields_queries;
  subscription_price_resolver: typeof subscription_price_resolver;
  testVortexAuth: typeof testVortexAuth;
  users: typeof users;
  "validations/organizations": typeof validations_organizations;
  "vortex_billing/catalog_mutations": typeof vortex_billing_catalog_mutations;
  "vortex_billing/catalog_queries": typeof vortex_billing_catalog_queries;
  "vortex_billing/catalog_sync": typeof vortex_billing_catalog_sync;
  "vortex_billing/payable_actions": typeof vortex_billing_payable_actions;
  "vortex_billing/projection": typeof vortex_billing_projection;
  "vortex_billing/proof_actions": typeof vortex_billing_proof_actions;
  "vortex_billing/webhook_handlers": typeof vortex_billing_webhook_handlers;
  "vortex_billing/webhook_signature": typeof vortex_billing_webhook_signature;
  "webhooks/delivery": typeof webhooks_delivery;
  "webhooks/mutations": typeof webhooks_mutations;
  "webhooks/publish": typeof webhooks_publish;
  "webhooks/queries": typeof webhooks_queries;
  "webhooks/slack_formatter": typeof webhooks_slack_formatter;
  "webhooks/vortex_surface": typeof webhooks_vortex_surface;
  "workflows/document_completion": typeof workflows_document_completion;
  "workflows/document_completion_steps": typeof workflows_document_completion_steps;
  "workflows/index": typeof workflows_index;
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

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  vortexAuth: import("@vortexnyc/auth/_generated/component.js").ComponentApi<"vortexAuth">;
  actionCache: import("@convex-dev/action-cache/_generated/component.js").ComponentApi<"actionCache">;
  actionRetrier: import("@convex-dev/action-retrier/_generated/component.js").ComponentApi<"actionRetrier">;
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
  aiUsageAggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aiUsageAggregate">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  aiPoolPro: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"aiPoolPro">;
  aiPoolFree: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"aiPoolFree">;
};
