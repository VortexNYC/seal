/**
 * Row-Level Security (RLS) for Seal Convex Backend
 *
 * This module provides row-level access control for all database operations.
 * It wraps the standard query and mutation functions to enforce access rules
 * based on user authentication, organization membership, and permissions.
 *
 * Based on the studio-1 reference implementation pattern.
 */

import type { Rules } from "convex-helpers/server/rowLevelSecurity";

import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getAuthContextWithPermissions } from "./auth/auth.permissions";
import { resolveComponentMembershipForOrganization } from "./lib/componentOrgReads";
import type { RecipientRole } from "./schemas/document_recipients";

/**
 * RLS Context type for Seal
 * Extended from studio-1 to support Seal's permission system
 */
export type SealRLSContext = {
  // Core identity
  userId: Id<"users"> | null;
  orgId: Id<"organizations"> | null;

  // Role and permissions
  role: string | null;
  permissions: string[];
  isOwner: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;

  // Permission helpers
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;

  // Document access cache (for performance)
  documentAccessCache: Map<Id<"documents">, "owner" | "manage" | "edit" | "view" | "none">;

  // Recipient context (for token-based access via document_recipients)
  recipientContext?: {
    recipientId: Id<"document_recipients">;
    documentId: Id<"documents">;
    email: string;
    role: RecipientRole;
  };
};

/**
 * Get RLS context from query context
 * Returns null if user is not authenticated
 */
async function getRLSContext(ctx: QueryCtx): Promise<SealRLSContext | null> {
  try {
    const auth = await getAuthContextWithPermissions(ctx);
    const isSuperAdmin = auth.permissions.includes("*");

    return {
      userId: auth.userId,
      orgId: auth.organizationId,
      role: auth.role,
      permissions: auth.permissions,
      isOwner: auth.isOwner,
      isAdmin: auth.isAdmin,
      isSuperAdmin,
      hasPermission: auth.hasPermission,
      hasAnyPermission: auth.hasAnyPermission,
      hasAllPermissions: auth.hasAllPermissions,
      documentAccessCache: new Map(),
    };
  } catch {
    // User is not authenticated
    return null;
  }
}

/**
 * Helper: Get document access level for a user
 * Handles the complex sharing logic (owner, workspace, specific)
 */
async function getDocumentAccessLevel(
  ctx: QueryCtx,
  rlsCtx: SealRLSContext,
  doc: Doc<"documents">,
): Promise<"owner" | "manage" | "edit" | "view" | "none"> {
  // Super admin always has full access
  if (rlsCtx.isSuperAdmin) return "owner";

  // Check cache first
  const cached = rlsCtx.documentAccessCache.get(doc._id);
  if (cached !== undefined) {
    return cached;
  }

  let accessLevel: "owner" | "manage" | "edit" | "view" | "none" = "none";

  // Owner always has full access
  if (doc.ownerId === rlsCtx.userId) {
    accessLevel = "owner";
  } else if (doc.organizationId === rlsCtx.orgId) {
    // Check sharing mode for org members
    if (doc.sharingMode === "workspace") {
      // All workspace members can view
      accessLevel = "view";
    } else if (doc.sharingMode === "specific") {
      // Check document_access table for specific grants
      const currentUserId = rlsCtx.userId;
      if (currentUserId) {
        const access = await ctx.db
          .query("document_access")
          .withIndex("by_document_user", (q) =>
            q.eq("documentId", doc._id).eq("userId", currentUserId),
          )
          .first();

        if (access && !access.revokedAt) {
          accessLevel = access.permissionLevel;
        }
      }
    }
    // "private" means only owner - already handled above
  }

  // Cache the result
  rlsCtx.documentAccessCache.set(doc._id, accessLevel);
  return accessLevel;
}

/**
 * Strict type that requires RLS rules for ALL tables in DataModel
 * TypeScript will error if any table is missing rules
 */
type StrictRules = {
  [K in keyof DataModel]: {
    read: (ctx: QueryCtx, doc: DataModel[K]["document"]) => Promise<boolean>;
    modify: (ctx: QueryCtx, doc: DataModel[K]["document"]) => Promise<boolean>;
  };
};

/**
 * Define RLS rules for each table
 * Exported for use in authQuery/authMutation wrappers
 */
function getUserManagementRules(
  ctx: QueryCtx,
  rlsCtx: SealRLSContext | null,
): Pick<StrictRules, "users" | "user_profiles" | "saved_signatures"> {
  return {
    users: {
      read: async (_ctx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (doc._id === rlsCtx.userId) return true;
        const currentOrgId = rlsCtx.orgId;
        if (rlsCtx.hasPermission("users:view") && currentOrgId) {
          const organization = await ctx.db.get(currentOrgId);
          if (!organization) return false;
          const membership = await resolveComponentMembershipForOrganization(
            ctx,
            doc,
            organization,
          );
          return membership !== null && membership.status === "active";
        }
        return false;
      },
      modify: async (_ctx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc._id === rlsCtx.userId;
      },
    },
    user_profiles: {
      read: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (!rlsCtx.userId) return false;
        const user = await queryCtx.db.get(rlsCtx.userId);
        return user !== null && user.authSubject === doc.authSubject;
      },
      modify: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (!rlsCtx.userId) return false;
        const user = await queryCtx.db.get(rlsCtx.userId);
        return user !== null && user.authSubject === doc.authSubject;
      },
    },
    saved_signatures: {
      read: async (_ctx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.userId === rlsCtx.userId;
      },
      modify: async (_ctx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.userId === rlsCtx.userId;
      },
    },
  };
}

function getOrganizationManagementRules(
  _ctx: QueryCtx,
  rlsCtx: SealRLSContext | null,
): Pick<StrictRules, "organizations"> {
  return {
    organizations: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return rlsCtx.orgId === doc._id;
      },
      modify: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.orgId !== doc._id) return false;
        return rlsCtx.hasPermission("organization:manage");
      },
    },
  };
}

function getPrimaryDocumentRules(
  ctx: QueryCtx,
  rlsCtx: SealRLSContext | null,
): Pick<StrictRules, "documents" | "document_access" | "document_recipients"> {
  return {
    documents: {
      read: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (doc.status === "deleted") return false;
        if (rlsCtx.recipientContext) {
          return doc._id === rlsCtx.recipientContext.documentId;
        }
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, doc);
        return access !== "none";
      },
      modify: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (doc.status === "deleted") return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, doc);
        return access === "owner" || access === "manage" || access === "edit";
      },
    },
    document_access: {
      read: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (doc.userId === rlsCtx.userId) return true;
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access === "owner" || access === "manage";
      },
      modify: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access === "owner" || access === "manage";
      },
    },
    document_recipients: {
      read: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.recipientContext) {
          return doc._id === rlsCtx.recipientContext.recipientId;
        }
        if (doc.userId && doc.userId === rlsCtx.userId) return true;
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access !== "none";
      },
      modify: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.recipientContext) {
          return doc._id === rlsCtx.recipientContext.recipientId;
        }
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access === "owner";
      },
    },
  };
}

function getDocumentWorkflowRules(
  _ctx: QueryCtx,
  rlsCtx: SealRLSContext | null,
): Pick<StrictRules, "document_reminders" | "folders" | "document_invoices"> {
  return {
    document_reminders: {
      read: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access !== "none";
      },
      modify: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access === "owner";
      },
    },
    folders: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (doc.organizationId !== rlsCtx.orgId) return false;
        if (doc.visibility === "admin") return rlsCtx.isAdmin;
        return true;
      },
      modify: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (doc.organizationId !== rlsCtx.orgId) return false;
        return rlsCtx.isAdmin || doc.createdBy === rlsCtx.userId;
      },
    },
    document_invoices: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.organizationId === rlsCtx.orgId;
      },
      modify: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (doc.organizationId !== rlsCtx.orgId) return false;
        return rlsCtx.isAdmin;
      },
    },
  };
}

function getDocumentAssetRules(
  _ctx: QueryCtx,
  rlsCtx: SealRLSContext | null,
): Pick<StrictRules, "document_versions" | "payment_field_configs"> {
  return {
    document_versions: {
      read: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        if (document.ownerId === rlsCtx.userId) return true;
        return document.sharingMode === "workspace" && document.organizationId === rlsCtx.orgId;
      },
      modify: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        const document = await queryCtx.db.get(doc.documentId);
        return document ? document.ownerId === rlsCtx.userId : false;
      },
    },
    payment_field_configs: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (doc.organizationId === rlsCtx.orgId) return true;
        return rlsCtx.recipientContext
          ? doc.documentId === rlsCtx.recipientContext.documentId
          : false;
      },
      modify: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (doc.organizationId !== rlsCtx.orgId) return false;
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access === "owner";
      },
    },
  };
}

function getSignatureWorkflowRules(
  _ctx: QueryCtx,
  rlsCtx: SealRLSContext | null,
): Pick<StrictRules, "recipients" | "signature_fields" | "signatures"> {
  return {
    recipients: {
      read: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access !== "none";
      },
      modify: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access === "owner";
      },
    },
    signature_fields: {
      read: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.recipientContext) {
          return doc.documentId === rlsCtx.recipientContext.documentId;
        }
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access !== "none";
      },
      modify: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.recipientContext) {
          return (
            doc.documentId === rlsCtx.recipientContext.documentId &&
            doc.recipientId === rlsCtx.recipientContext.recipientId
          );
        }
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access === "owner" || (access === "edit" && document.workflowStatus === "draft");
      },
    },
    signatures: {
      read: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.recipientContext) {
          return doc.documentId === rlsCtx.recipientContext.documentId;
        }
        const document = await queryCtx.db.get(doc.documentId);
        if (!document) return false;
        const access = await getDocumentAccessLevel(queryCtx, rlsCtx, document);
        return access !== "none";
      },
      modify: async () => false,
    },
  };
}

function getTemplateAndContactRules(
  _ctx: QueryCtx,
  rlsCtx: SealRLSContext | null,
): Pick<StrictRules, "templates" | "template_fields" | "contacts"> {
  return {
    templates: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (doc.status === "deleted" || rlsCtx.orgId !== doc.organizationId) return false;
        return rlsCtx.hasPermission("templates:view") || rlsCtx.hasPermission("templates:read");
      },
      modify: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (doc.status === "deleted" || rlsCtx.orgId !== doc.organizationId) return false;
        if (doc.createdBy === rlsCtx.userId) return true;
        return rlsCtx.hasPermission("templates:edit");
      },
    },
    template_fields: {
      read: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        const template = await queryCtx.db.get(doc.templateId);
        if (!template || template.status === "deleted") return false;
        if (rlsCtx.orgId !== template.organizationId) return false;
        return rlsCtx.hasPermission("templates:view");
      },
      modify: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        const template = await queryCtx.db.get(doc.templateId);
        if (!template || template.status === "deleted") return false;
        if (rlsCtx.orgId !== template.organizationId) return false;
        if (template.createdBy === rlsCtx.userId) return true;
        return rlsCtx.hasPermission("templates:edit");
      },
    },
    contacts: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.orgId !== doc.organizationId) return false;
        return rlsCtx.hasPermission("contacts:view");
      },
      modify: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.orgId !== doc.organizationId) return false;
        if (doc.createdBy === rlsCtx.userId) return true;
        return rlsCtx.hasPermission("contacts:edit");
      },
    },
  };
}

function getAuditAndBillingRules(
  _ctx: QueryCtx,
  rlsCtx: SealRLSContext | null,
): Pick<
  StrictRules,
  | "audit_logs"
  | "subscriptions"
  | "subscription_products"
  | "subscription_prices"
  | "merchant_accounts"
  | "stripe_accounts"
  | "stripe_webhook_events"
  | "vortex_billing_webhook_events"
  | "feedback"
> {
  return {
    feedback: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.orgId !== doc.organizationId) return false;
        return rlsCtx.isAdmin || doc.userId === rlsCtx.userId;
      },
      modify: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.organizationId === rlsCtx.orgId;
      },
    },
    audit_logs: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.orgId !== doc.organizationId) return false;
        return rlsCtx.hasPermission("audit:view") || rlsCtx.hasPermission("audit:read");
      },
      modify: async () => false,
    },
    subscriptions: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.organizationId === rlsCtx.orgId;
      },
      modify: async () => false,
    },
    subscription_products: {
      read: async () => rlsCtx !== null,
      modify: async () => false,
    },
    subscription_prices: {
      read: async () => rlsCtx !== null,
      modify: async () => false,
    },
    merchant_accounts: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.organizationId === rlsCtx.orgId;
      },
      modify: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (doc.organizationId !== rlsCtx.orgId) return false;
        return rlsCtx.isAdmin;
      },
    },
    stripe_accounts: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.organizationId === rlsCtx.orgId;
      },
      modify: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (doc.organizationId !== rlsCtx.orgId) return false;
        return rlsCtx.isAdmin;
      },
    },
    stripe_webhook_events: {
      read: async () => Boolean(rlsCtx?.isSuperAdmin),
      modify: async () => false,
    },
    vortex_billing_webhook_events: {
      read: async () => Boolean(rlsCtx?.isSuperAdmin),
      modify: async () => false,
    },
  };
}

function getIntegrationAndWebhookRules(
  _ctx: QueryCtx,
  rlsCtx: SealRLSContext | null,
): Pick<
  StrictRules,
  | "connected_apps"
  | "integration_activity_logs"
  | "notifications"
  | "webhook_endpoints"
  | "webhook_deliveries"
> {
  return {
    connected_apps: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.userId === rlsCtx.userId;
      },
      modify: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.userId === rlsCtx.userId;
      },
    },
    integration_activity_logs: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.userId === rlsCtx.userId;
      },
      modify: async () => false,
    },
    notifications: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.userId === rlsCtx.userId;
      },
      modify: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        return doc.userId === rlsCtx.userId;
      },
    },
    webhook_endpoints: {
      read: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.orgId !== doc.organizationId) return false;
        return rlsCtx.hasPermission("settings:integrations");
      },
      modify: async (_queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.orgId !== doc.organizationId) return false;
        return rlsCtx.hasPermission("settings:integrations");
      },
    },
    webhook_deliveries: {
      read: async (queryCtx, doc) => {
        if (!rlsCtx) return false;
        if (rlsCtx.isSuperAdmin) return true;
        if (rlsCtx.orgId !== doc.organizationId) return false;
        const endpoint = await queryCtx.db.get(doc.endpointId);
        if (!endpoint) return false;
        return rlsCtx.hasPermission("settings:integrations");
      },
      modify: async () => false,
    },
  };
}

function getInternalOnlyRules(
  _ctx: QueryCtx,
  rlsCtx: SealRLSContext | null,
): Pick<StrictRules, "download_tokens" | "subscription_coupons" | "subscription_promo_codes"> {
  return {
    download_tokens: {
      read: async () => false,
      modify: async () => false,
    },
    subscription_coupons: {
      read: async () => rlsCtx !== null,
      modify: async () => false,
    },
    subscription_promo_codes: {
      read: async () => rlsCtx !== null,
      modify: async () => false,
    },
  };
}

function getExportAndAiRules(
  _ctx: QueryCtx,
  rlsCtx: SealRLSContext | null,
): Pick<
  StrictRules,
  | "data_exports"
  | "ai_threads"
  | "ai_progress"
  | "ai_field_suggestions"
  | "ai_document_annotations"
  | "ai_routing_logs"
  | "ai_usage_log"
> {
  return {
    data_exports: {
      read: async (_queryCtx, doc) => Boolean(rlsCtx && doc.userId === rlsCtx.userId),
      modify: async (_queryCtx, doc) => Boolean(rlsCtx && doc.userId === rlsCtx.userId),
    },
    ai_threads: {
      read: async (_queryCtx, doc) =>
        Boolean(rlsCtx && (rlsCtx.isSuperAdmin || doc.organizationId === rlsCtx.orgId)),
      modify: async (_queryCtx, doc) =>
        Boolean(rlsCtx && (rlsCtx.isSuperAdmin || doc.organizationId === rlsCtx.orgId)),
    },
    ai_progress: {
      read: async () => rlsCtx !== null,
      modify: async () => false,
    },
    ai_field_suggestions: {
      read: async (_queryCtx, doc) =>
        Boolean(rlsCtx && (rlsCtx.isSuperAdmin || doc.organizationId === rlsCtx.orgId)),
      modify: async (_queryCtx, doc) =>
        Boolean(rlsCtx && (rlsCtx.isSuperAdmin || doc.organizationId === rlsCtx.orgId)),
    },
    ai_document_annotations: {
      read: async (_queryCtx, doc) =>
        Boolean(rlsCtx && (rlsCtx.isSuperAdmin || doc.organizationId === rlsCtx.orgId)),
      modify: async (_queryCtx, doc) =>
        Boolean(rlsCtx && (rlsCtx.isSuperAdmin || doc.organizationId === rlsCtx.orgId)),
    },
    ai_routing_logs: {
      read: async () => Boolean(rlsCtx?.isSuperAdmin),
      modify: async () => false,
    },
    ai_usage_log: {
      read: async (_queryCtx, doc) =>
        Boolean(rlsCtx && (rlsCtx.isSuperAdmin || doc.organizationId === rlsCtx.orgId)),
      modify: async (_queryCtx, doc) =>
        Boolean(rlsCtx && (rlsCtx.isSuperAdmin || doc.organizationId === rlsCtx.orgId)),
    },
  };
}

export async function rlsRules(ctx: QueryCtx): Promise<Rules<QueryCtx, DataModel>> {
  const rlsCtx = await getRLSContext(ctx);

  const rules: StrictRules = {
    ...getUserManagementRules(ctx, rlsCtx),
    ...getOrganizationManagementRules(ctx, rlsCtx),
    ...getPrimaryDocumentRules(ctx, rlsCtx),
    ...getDocumentWorkflowRules(ctx, rlsCtx),
    ...getDocumentAssetRules(ctx, rlsCtx),
    ...getSignatureWorkflowRules(ctx, rlsCtx),
    ...getTemplateAndContactRules(ctx, rlsCtx),
    ...getAuditAndBillingRules(ctx, rlsCtx),
    ...getIntegrationAndWebhookRules(ctx, rlsCtx),
    ...getInternalOnlyRules(ctx, rlsCtx),
    ...getExportAndAiRules(ctx, rlsCtx),
  };

  return rules as Rules<QueryCtx, DataModel>;
}
