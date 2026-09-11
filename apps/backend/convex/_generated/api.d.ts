/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as payments_saas_billing_provider from "../payments/saas_billing_provider.js";
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
import type * as schemas_document_recipients from "../schemas/document_recipients.js";
import type * as schemas_document_reminders from "../schemas/document_reminders.js";
import type * as schemas_document_versions from "../schemas/document_versions.js";
import type * as schemas_document_workflow_status from "../schemas/document_workflow_status.js";
import type * as schemas_documents from "../schemas/documents.js";
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
import type * as vortex_billing_catalog_mutations from "../vortex_billing/catalog_mutations.js";
import type * as vortex_billing_catalog_sync from "../vortex_billing/catalog_sync.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  "payments/saas_billing_provider": typeof payments_saas_billing_provider;
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
  "schemas/document_recipients": typeof schemas_document_recipients;
  "schemas/document_reminders": typeof schemas_document_reminders;
  "schemas/document_versions": typeof schemas_document_versions;
  "schemas/document_workflow_status": typeof schemas_document_workflow_status;
  "schemas/documents": typeof schemas_documents;
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
  "vortex_billing/catalog_mutations": typeof vortex_billing_catalog_mutations;
  "vortex_billing/catalog_sync": typeof vortex_billing_catalog_sync;
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
  betterAuthConsumer: import("@vortexnyc/auth/_generated/component.js").ComponentApi<"betterAuthConsumer">;
  actionCache: import("@convex-dev/action-cache/_generated/component.js").ComponentApi<"actionCache">;
  actionRetrier: import("@convex-dev/action-retrier/_generated/component.js").ComponentApi<"actionRetrier">;
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
  aiUsageAggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aiUsageAggregate">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  aiPoolPro: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"aiPoolPro">;
  aiPoolFree: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"aiPoolFree">;
};
