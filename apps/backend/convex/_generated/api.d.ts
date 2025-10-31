/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth_guards from "../auth/guards.js";
import type * as auth_permissions from "../auth/permissions.js";
import type * as auth_wrappers from "../auth/wrappers.js";
import type * as auth from "../auth.js";
import type * as check_membership from "../check_membership.js";
import type * as documents_mutations from "../documents/mutations.js";
import type * as documents_queries from "../documents/queries.js";
import type * as documents_sharing from "../documents/sharing.js";
import type * as documents_workflow_helpers from "../documents/workflow_helpers.js";
import type * as http from "../http.js";
import type * as organization_roles_helpers from "../organization_roles/helpers.js";
import type * as organization_roles_migrations from "../organization_roles/migrations.js";
import type * as organization_roles_mutations from "../organization_roles/mutations.js";
import type * as organization_roles_queries from "../organization_roles/queries.js";
import type * as organizations_actions from "../organizations/actions.js";
import type * as organizations_helpers from "../organizations/helpers.js";
import type * as organizations_mutations from "../organizations/mutations.js";
import type * as organizations_queries from "../organizations/queries.js";
import type * as schemas_document_access from "../schemas/document_access.js";
import type * as schemas_document_workflow_status from "../schemas/document_workflow_status.js";
import type * as schemas_documents from "../schemas/documents.js";
import type * as schemas_organization_invitations from "../schemas/organization_invitations.js";
import type * as schemas_organization_members from "../schemas/organization_members.js";
import type * as schemas_organization_roles from "../schemas/organization_roles.js";
import type * as schemas_organizations from "../schemas/organizations.js";
import type * as schemas_subscription_prices from "../schemas/subscription_prices.js";
import type * as schemas_subscription_products from "../schemas/subscription_products.js";
import type * as schemas_subscriptions from "../schemas/subscriptions.js";
import type * as schemas_users from "../schemas/users.js";
import type * as stripe_handlers from "../stripe/handlers.js";
import type * as stripe_helpers from "../stripe/helpers.js";
import type * as stripe_sync from "../stripe/sync.js";
import type * as stripe_sync_helpers from "../stripe/sync_helpers.js";
import type * as stripe_webhook_handlers from "../stripe/webhook_handlers.js";
import type * as validations_organizations from "../validations/organizations.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "auth/guards": typeof auth_guards;
  "auth/permissions": typeof auth_permissions;
  "auth/wrappers": typeof auth_wrappers;
  auth: typeof auth;
  check_membership: typeof check_membership;
  "documents/mutations": typeof documents_mutations;
  "documents/queries": typeof documents_queries;
  "documents/sharing": typeof documents_sharing;
  "documents/workflow_helpers": typeof documents_workflow_helpers;
  http: typeof http;
  "organization_roles/helpers": typeof organization_roles_helpers;
  "organization_roles/migrations": typeof organization_roles_migrations;
  "organization_roles/mutations": typeof organization_roles_mutations;
  "organization_roles/queries": typeof organization_roles_queries;
  "organizations/actions": typeof organizations_actions;
  "organizations/helpers": typeof organizations_helpers;
  "organizations/mutations": typeof organizations_mutations;
  "organizations/queries": typeof organizations_queries;
  "schemas/document_access": typeof schemas_document_access;
  "schemas/document_workflow_status": typeof schemas_document_workflow_status;
  "schemas/documents": typeof schemas_documents;
  "schemas/organization_invitations": typeof schemas_organization_invitations;
  "schemas/organization_members": typeof schemas_organization_members;
  "schemas/organization_roles": typeof schemas_organization_roles;
  "schemas/organizations": typeof schemas_organizations;
  "schemas/subscription_prices": typeof schemas_subscription_prices;
  "schemas/subscription_products": typeof schemas_subscription_products;
  "schemas/subscriptions": typeof schemas_subscriptions;
  "schemas/users": typeof schemas_users;
  "stripe/handlers": typeof stripe_handlers;
  "stripe/helpers": typeof stripe_helpers;
  "stripe/sync": typeof stripe_sync;
  "stripe/sync_helpers": typeof stripe_sync_helpers;
  "stripe/webhook_handlers": typeof stripe_webhook_handlers;
  "validations/organizations": typeof validations_organizations;
  webhooks: typeof webhooks;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
