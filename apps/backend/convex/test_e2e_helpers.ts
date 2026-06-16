/**
 * E2E Test Helpers
 *
 * Internal mutations used exclusively by Playwright global.setup.ts
 * to seed test data in the E2E test deployment.
 *
 * These functions are NOT public API and should never be called in production.
 */

import { v } from "convex/values";
import Stripe from "stripe";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import {
  listComponentInvitationsByOrganization,
  listComponentMembersByOrganization,
  resolveComponentMembershipForOrganization,
} from "./lib/componentOrgReads";
import { setVortexAuthInvitationStatus } from "./lib/vortexAuthOrganizations";
import { getOrCreateStripeCustomer } from "./stripe/helpers";

/**
 * Gate all public test helpers behind an env var that is only set on the E2E
 * test deployment (coordinated-lemur-768).  Without this, any unauthenticated
 * caller who knows the Convex URL could invoke these mutations.
 *
 * To enable: `bunx convex env set E2E_DEPLOYMENT_SECRET <any-value> --deployment coordinated-lemur-768`
 */
function requireE2eDeployment(): void {
  if (!process.env.E2E_DEPLOYMENT_SECRET) {
    throw new Error(
      "Test helper functions are disabled. E2E_DEPLOYMENT_SECRET is not set on this deployment.",
    );
  }
}

async function resolveE2eDocumentOwner(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  ownerAuthSubject?: string,
  ownerEmail?: string,
): Promise<Doc<"users">> {
  if (ownerAuthSubject) {
    const owner = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", ownerAuthSubject))
      .first();

    if (!owner) {
      throw new Error(`e2e_owner_auth_subject_not_found: ${ownerAuthSubject}`);
    }

    const organization = await ctx.db.get(organizationId);
    if (!organization) {
      throw new Error(`e2e_organization_not_found: ${organizationId}`);
    }
    const membership = await resolveComponentMembershipForOrganization(ctx, owner, organization);

    if (membership?.status !== "active") {
      throw new Error(`e2e_owner_auth_subject_not_active_member: ${ownerAuthSubject}`);
    }

    return owner;
  }

  if (ownerEmail) {
    const owners = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", ownerEmail))
      .collect();

    if (owners.length === 0) {
      throw new Error(`e2e_owner_not_found: ${ownerEmail}`);
    }

    for (const owner of owners) {
      const organization = await ctx.db.get(organizationId);
      if (!organization) {
        throw new Error(`e2e_organization_not_found: ${organizationId}`);
      }
      const membership = await resolveComponentMembershipForOrganization(ctx, owner, organization);

      if (membership?.status === "active") {
        return owner;
      }
    }

    throw new Error(`e2e_owner_not_active_member: ${ownerEmail}`);
  }

  const organization = await ctx.db.get(organizationId);
  if (!organization) {
    throw new Error(`e2e_organization_not_found: ${organizationId}`);
  }
  const activeMember = (
    await listComponentMembersByOrganization(ctx, organization, { status: "active" })
  ).find((member) => member.userId !== null);

  if (!activeMember?.userId) {
    throw new Error(`no_active_member_found_for_org: ${organizationId}`);
  }

  const ownerUserId = activeMember.userId;
  const owner = await ctx.db.get(ownerUserId);
  if (!owner) {
    throw new Error(`member_user_not_found_for_org: ${organizationId}`);
  }

  return owner;
}

/**
 * Seed a pro subscription for the E2E workspace, looked up by its known slug.
 * Called from global.setup.ts via `bunx convex run` — no org ID required.
 *
 * Uses a regular mutation (not internal) so it's callable from the CLI.
 * Only deployed on the E2E test deployment — never exposed in production.
 */
export const seedProSubscriptionForE2E = mutation({
  args: {
    organizationSlug: v.string(),
  },
  handler: async (ctx, { organizationSlug }) => {
    requireE2eDeployment();

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", organizationSlug))
      .first();

    if (!org) {
      return { seeded: false, reason: "org_not_found" };
    }

    const now = Date.now();
    const externalProductId = "prod_e2e_test_pro";
    const externalPriceId = "price_e2e_test_pro_monthly";

    // Ensure product exists with tier: "pro" metadata so getSubscriptionDetails resolves tier correctly
    const existingProduct = await ctx.db
      .query("subscription_products")
      .withIndex("by_external_product_id", (q) => q.eq("externalProductId", externalProductId))
      .first();

    if (!existingProduct) {
      await ctx.db.insert("subscription_products", {
        externalProductId,
        name: "Seal Pro (E2E Test)",
        status: "active",
        metadata: { tier: "pro" },
        createdAt: now,
        updatedAt: now,
      });
    }

    // Ensure price exists
    const existingPrice = await ctx.db
      .query("subscription_prices")
      .withIndex("by_external_price_id", (q) => q.eq("externalPriceId", externalPriceId))
      .first();

    if (!existingPrice) {
      const product = await ctx.db
        .query("subscription_products")
        .withIndex("by_external_product_id", (q) => q.eq("externalProductId", externalProductId))
        .first();

      await ctx.db.insert("subscription_prices", {
        externalPriceId,
        externalProductId,
        subscriptionProductId: product!._id,
        type: "recurring",
        billingScheme: "per_unit",
        currency: "usd",
        unitAmount: 1500,
        recurring: { interval: "month", intervalCount: 1 },
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Idempotency check — product/price are always ensured above regardless
    const existing =
      (await ctx.db
        .query("subscriptions")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", org._id).eq("status", "active"),
        )
        .first()) ??
      (await ctx.db
        .query("subscriptions")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", org._id).eq("status", "trialing"),
        )
        .first());

    if (existing) return { seeded: false, reason: "subscription_already_active" };

    await ctx.db.insert("subscriptions", {
      organizationId: org._id,
      externalCustomerId: "cus_e2e_test",
      externalSubscriptionId: `sub_e2e_test_${org._id}`,
      externalPriceId,
      status: "active",
      currentPeriodStart: now - 30 * 24 * 60 * 60 * 1000,
      currentPeriodEnd: now + 365 * 24 * 60 * 60 * 1000,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    return { seeded: true, orgId: org._id };
  },
});

/**
 * Purge all documents for the E2E workspace to prevent dashboard queries from
 * hitting Convex's per-transaction task limit after many test runs.
 *
 * Deletes up to `batchSize` documents per call (idempotent, call multiple times
 * if the org has accumulated many documents). Returns the number deleted and
 * whether more remain.
 */
export const purgeE2EDocuments = mutation({
  args: {
    organizationSlug: v.string(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { organizationSlug, batchSize = 200 }) => {
    requireE2eDeployment();

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", organizationSlug))
      .first();

    if (!org) {
      return { deleted: 0, hasMore: false, reason: "org_not_found" };
    }

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .take(batchSize + 1);

    const hasMore = docs.length > batchSize;
    const toDelete = docs.slice(0, batchSize);

    for (const doc of toDelete) {
      await ctx.db.delete(doc._id);
    }

    return { deleted: toDelete.length, hasMore };
  },
});

/**
 * Revoke pending invitations for the E2E workspace. The vortexAuth component
 * invitation list is capped, so stale pending invites can hide freshly-created
 * test invites from the team-management UI.
 */
export const purgeE2EPendingInvitations = mutation({
  args: {
    organizationSlug: v.string(),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { organizationSlug, batchSize = 50 }) => {
    requireE2eDeployment();

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", organizationSlug))
      .first();

    if (!org) {
      return { revoked: 0, hasMore: false, reason: "org_not_found" };
    }

    const invitations = await listComponentInvitationsByOrganization(ctx, org, "pending", {
      limit: batchSize + 1,
    });
    const hasMore = invitations.length > batchSize;
    const toRevoke = invitations.slice(0, batchSize);

    for (const invitation of toRevoke) {
      await setVortexAuthInvitationStatus(ctx, {
        organizationId: invitation.organizationId,
        invitationId: invitation._id,
        status: "revoked",
      });
    }

    return { revoked: toRevoke.length, hasMore };
  },
});

/**
 * Generate a Convex storage upload URL for E2E test PDF seeding.
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    requireE2eDeployment();
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a minimal test document for E2E tests.
 * Accepts a pre-uploaded storageId so the PDF only needs to be uploaded once.
 * Returns the new document's _id.
 */
export const createTestDocument = mutation({
  args: {
    organizationSlug: v.string(),
    storageId: v.string(),
    name: v.optional(v.string()),
    ownerAuthSubject: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
  },
  handler: async (ctx, { organizationSlug, storageId, name, ownerAuthSubject, ownerEmail }) => {
    requireE2eDeployment();

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", organizationSlug))
      .first();
    if (!org) throw new Error(`org_not_found: ${organizationSlug}`);

    const owner = await resolveE2eDocumentOwner(ctx, org._id, ownerAuthSubject, ownerEmail);

    const now = Date.now();
    const docId = await ctx.db.insert("documents", {
      organizationId: org._id,
      ownerId: owner._id,
      name: name ?? `e2e-test-doc-${now}`,
      status: "active",
      workflowStatus: "draft",
      sharingMode: "private",
      fileSize: 12345,
      fileType: "application/pdf",
      storageId,
      createdAt: now,
      updatedAt: now,
    });

    return { id: docId };
  },
});

/**
 * Build a fully prepared signable document for the recipient signing E2E test:
 * - one document in workflowStatus="sent"
 * - one signer recipient with a fresh signingToken
 * - one main signature field bound to that recipient on page 1
 *
 * Returns the signing token plus the IDs the test needs for assertions
 * (document state, audit log) once signing completes.
 */
export const createSignableTestDocument = mutation({
  args: {
    organizationSlug: v.string(),
    storageId: v.string(),
    name: v.optional(v.string()),
    ownerAuthSubject: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
    recipientEmail: v.optional(v.string()),
    recipientName: v.optional(v.string()),
    // When "draft", the doc + recipient are created but the doc stays editable
    // by the owner (canEdit=true in the doc editor). Useful for tests that need
    // to drive editor-only affordances like "Save as Template". Defaults to
    // "sent" because the recipient signing test depends on the sent state.
    workflowStatus: v.optional(v.union(v.literal("sent"), v.literal("draft"))),
  },
  handler: async (
    ctx,
    {
      organizationSlug,
      storageId,
      name,
      ownerAuthSubject,
      ownerEmail,
      recipientEmail,
      recipientName,
      workflowStatus,
    },
  ) => {
    requireE2eDeployment();
    const desiredStatus = workflowStatus ?? "sent";

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", organizationSlug))
      .first();
    if (!org) throw new Error(`org_not_found: ${organizationSlug}`);

    const owner = await resolveE2eDocumentOwner(ctx, org._id, ownerAuthSubject, ownerEmail);

    const now = Date.now();
    const docId = await ctx.db.insert("documents", {
      organizationId: org._id,
      ownerId: owner._id,
      name: name ?? `e2e-signable-doc-${now}`,
      status: "active",
      workflowStatus: desiredStatus,
      sharingMode: "specific",
      fileSize: 12345,
      fileType: "application/pdf",
      storageId,
      // Only stamp sentAt when we're seeding directly into "sent" — leaves
      // draft docs in a clean pre-send state.
      sentAt: desiredStatus === "sent" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Recipient — random plaintext token, 24h expiry. Production uses tokenHash for
    // lookup but seed both columns so either lookup path works.
    const tokenSuffix = `${now.toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    const signingToken = `e2e-${tokenSuffix}`;
    const tokenHash = await sha256Hex(signingToken);
    const recipientId = await ctx.db.insert("document_recipients", {
      documentId: docId,
      email: recipientEmail ?? `e2e-recipient-${now}@example.com`,
      name: recipientName ?? "E2E Recipient",
      role: "signer",
      status: "pending",
      order: 1,
      signingToken,
      tokenHash,
      tokenExpiresAt: now + 24 * 60 * 60 * 1000,
      sentAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const fieldId = await ctx.db.insert("signature_fields", {
      documentId: docId,
      recipientId,
      fieldType: "signature",
      label: "Signature",
      isRequired: true,
      isMainSignature: true,
      x: 35,
      y: 35,
      width: 30,
      height: 8,
      page: 1,
      createdAt: now,
      updatedAt: now,
    });

    return {
      documentId: docId,
      recipientId,
      signingToken,
      fieldId,
    };
  },
});

/**
 * Read the workflow state of an E2E-seeded document so the test can assert
 * the post-signing transition without needing org-scoped auth.
 */
export const getTestDocumentState = query({
  args: {
    documentId: v.string(),
  },
  handler: async (ctx, { documentId }) => {
    requireE2eDeployment();
    const id = documentId as Id<"documents">;
    const doc = await ctx.db.get(id);
    if (!doc) return null;

    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", id))
      .collect();

    const auditEntries = await ctx.db
      .query("audit_logs")
      .withIndex("by_document", (q) => q.eq("documentId", id))
      .collect();

    return {
      workflowStatus: doc.workflowStatus,
      status: doc.status,
      recipients: recipients.map((r) => ({
        id: r._id,
        status: r.status,
        signedAt: r.signedAt ?? null,
      })),
      auditActions: auditEntries.map((a) => a.action),
    };
  },
});

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Delete a test document by ID.
 */
export const deleteTestDocument = mutation({
  args: {
    documentId: v.string(),
  },
  handler: async (ctx, { documentId }) => {
    requireE2eDeployment();
    const id = documentId as Id<"documents">;
    const doc = await ctx.db.get(id);
    if (doc) await ctx.db.delete(id);
    return { deleted: !!doc };
  },
});

/**
 * Debug: get org info by slug (no auth required).
 */
export const getOrgDebugInfo = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    requireE2eDeployment();

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!org) return null;
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", org._id))
      .first();
    return { slug: org.slug, hasSub: !!sub, subStatus: sub?.status };
  },
});

/**
 * Seed a pro subscription for the given organization.
 * Idempotent — does nothing if an active subscription already exists.
 */
export const seedProSubscription = internalMutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, { organizationId }) => {
    // Check if org already has an active subscription
    const existing =
      (await ctx.db
        .query("subscriptions")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "active"),
        )
        .first()) ??
      (await ctx.db
        .query("subscriptions")
        .withIndex("by_organization_status", (q) =>
          q.eq("organizationId", organizationId).eq("status", "trialing"),
        )
        .first());

    if (existing) return { seeded: false, reason: "subscription_already_active" };

    const now = Date.now();
    const externalProductId = "prod_e2e_test_pro";
    const externalPriceId = "price_e2e_test_pro_monthly";

    // Ensure product exists
    const existingProduct = await ctx.db
      .query("subscription_products")
      .withIndex("by_external_product_id", (q) => q.eq("externalProductId", externalProductId))
      .first();

    if (!existingProduct) {
      await ctx.db.insert("subscription_products", {
        externalProductId,
        name: "Seal Pro (E2E Test)",
        status: "active",
        metadata: { tier: "pro" },
        createdAt: now,
        updatedAt: now,
      });
    }

    // Ensure price exists
    const existingPrice = await ctx.db
      .query("subscription_prices")
      .withIndex("by_external_price_id", (q) => q.eq("externalPriceId", externalPriceId))
      .first();

    if (!existingPrice) {
      await ctx.db.insert("subscription_prices", {
        externalPriceId,
        externalProductId,
        subscriptionProductId: (await ctx.db
          .query("subscription_products")
          .withIndex("by_external_product_id", (q) => q.eq("externalProductId", externalProductId))
          .first())!._id,
        type: "recurring",
        billingScheme: "per_unit",
        currency: "usd",
        unitAmount: 1500,
        recurring: { interval: "month", intervalCount: 1 },
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create subscription
    await ctx.db.insert("subscriptions", {
      organizationId,
      externalCustomerId: "cus_e2e_test",
      externalSubscriptionId: `sub_e2e_test_${organizationId}`,
      externalPriceId,
      status: "active",
      currentPeriodStart: now - 30 * 24 * 60 * 60 * 1000,
      currentPeriodEnd: now + 365 * 24 * 60 * 60 * 1000, // 1 year
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    return { seeded: true };
  },
});

/**
 * Look up an org by slug for the Stripe customer seeder.
 * Internal so the action can resolve the workspace + sender email without
 * round-tripping through a public mutation.
 */
export const getOrgForStripeSeeding = internalQuery({
  args: { organizationSlug: v.string() },
  handler: async (ctx, { organizationSlug }) => {
    requireE2eDeployment();

    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", organizationSlug))
      .first();
    if (!org) return null;

    const owner = await ctx.db
      .query("users")
      .withIndex("by_active_org", (q) => q.eq("activeOrganizationId", org._id))
      .first();

    return {
      organizationId: org._id,
      organizationName: org.name,
      stripeCustomerId: org.stripeCustomerId ?? null,
      ownerEmail: owner?.email ?? null,
    };
  },
});

/**
 * Persist a Stripe customer id on the org. Called from
 * `seedStripeCustomerForE2E` after the action has spoken to Stripe.
 */
export const setOrgStripeCustomerId = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, { organizationId, stripeCustomerId }) => {
    requireE2eDeployment();
    await ctx.db.patch(organizationId, {
      stripeCustomerId,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Provision a real Stripe sandbox customer for the E2E workspace and pin its
 * id on `organizations.stripeCustomerId`. Idempotent — exits early if the org
 * already has a customer record.
 *
 * This unblocks any test that exercises Stripe actions which require a real
 * customer (e.g. `createCustomerPortalSession`). The synthetic
 * `seedProSubscriptionForE2E` row alone isn't enough — Stripe's portal API
 * looks up the actual customer in Stripe's records, not Convex's.
 *
 * Mutations can't make external HTTP calls, so this lives as an action and
 * writes back via `setOrgStripeCustomerId`.
 */
export const seedStripeCustomerForE2E = action({
  args: {
    organizationSlug: v.string(),
  },
  handler: async (
    ctx,
    { organizationSlug },
  ): Promise<{ seeded: boolean; stripeCustomerId: string; reason?: string }> => {
    requireE2eDeployment();

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY not configured on this deployment — cannot seed Stripe customer",
      );
    }

    const orgInfo = await ctx.runQuery(internal.test_e2e_helpers.getOrgForStripeSeeding, {
      organizationSlug,
    });
    if (!orgInfo) {
      return { seeded: false, stripeCustomerId: "", reason: "org_not_found" };
    }

    if (orgInfo.stripeCustomerId) {
      return {
        seeded: false,
        stripeCustomerId: orgInfo.stripeCustomerId,
        reason: "already_seeded",
      };
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const stripeCustomerId = await getOrCreateStripeCustomer(
      stripe,
      orgInfo.organizationId,
      orgInfo.ownerEmail ?? `e2e-${orgInfo.organizationId}@example.com`,
      orgInfo.organizationName,
    );

    await ctx.runMutation(internal.test_e2e_helpers.setOrgStripeCustomerId, {
      organizationId: orgInfo.organizationId,
      stripeCustomerId,
    });

    return { seeded: true, stripeCustomerId };
  },
});
