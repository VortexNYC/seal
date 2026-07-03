"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { isAdmin } from "../auth.utils";
import {
  isDocumentPaymentOrganizationAllowlisted,
  readVortexBillingEnvFromProcess,
  requestVortexBillingJson,
} from "../vortex_billing/payable_actions";

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };
type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

type VortexMerchantState = {
  readonly chargesEnabled: boolean;
  readonly payoutsEnabled: boolean;
  readonly detailsSubmitted: boolean;
  readonly requirements: {
    readonly currentlyDue: string[];
    readonly eventuallyDue: string[];
    readonly pastDue: string[];
    readonly disabledReason?: string;
  };
  readonly capabilities: {
    readonly cardPayments: string;
    readonly transfers: string;
    readonly usBankAccountAchPayments?: string;
  };
};

type CreateVortexMerchantAccountResult = {
  readonly merchantAccountId: string;
  readonly state: VortexMerchantState;
};

type CreateVortexOnboardingLinkResult = {
  readonly url: string;
  readonly onboardingSessionId: string;
  readonly expiresAt: string;
};

type FeeHandling = "absorb" | "pass_to_recipient";

async function resolveAdminMembership(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.runQuery(internal.organizations.helpers.getUserByAuthSubject, {
    authSubject: identity.subject,
  });

  if (!user) {
    throw new ConvexError("User not found");
  }

  const membership = await ctx.runQuery(
    internal.organizations.helpers.getActiveMembershipByUserAndOrganization,
    {
      userId: user._id,
      organizationId,
    },
  );

  if (!membership) {
    throw new ConvexError("Organization membership required");
  }

  if (!isAdmin(membership)) {
    throw new ConvexError("Only workspace owners and admins can manage Vortex merchant settings");
  }
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConvexError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConvexError(`${label} must be a non-empty string`);
  }
  return value;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new ConvexError(`${label} must be a non-empty string when present`);
  }
  return value;
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new ConvexError(`${label} must be a boolean`);
  }
  return value;
}

function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new ConvexError(`${label} must be a string array`);
  }
  return value.map((entry) => readString(entry, label));
}

function readVortexMerchantAccountId(body: unknown): string {
  const root = readObject(body, "Vortex merchant response");
  const data = readObject(root.data, "Vortex merchant response data");
  return (
    readOptionalString(data.merchantAccountId, "Vortex merchant account id") ??
    readString(data.id, "Vortex merchant id")
  );
}

function readVortexOnboardingLink(body: unknown): CreateVortexOnboardingLinkResult {
  const root = readObject(body, "Vortex onboarding link response");
  const data = readObject(root.data, "Vortex onboarding link response data");
  return {
    url: readString(data.url, "Vortex onboarding link url"),
    onboardingSessionId: readString(
      data.onboardingSessionId,
      "Vortex onboarding session id",
    ),
    expiresAt: readString(data.expiresAt, "Vortex onboarding link expiration"),
  };
}

function mapCapabilityStatus(
  activeCapabilityKeys: readonly string[],
  restrictedCapabilityKeys: readonly string[],
  capabilityKey: string,
): string {
  if (activeCapabilityKeys.includes(capabilityKey)) {
    return "active";
  }
  if (restrictedCapabilityKeys.includes(capabilityKey)) {
    return "restricted";
  }
  return "inactive";
}

function mapVortexState(input: {
  readonly stateBody: unknown;
  readonly capabilitiesBody: unknown;
}): VortexMerchantState {
  const stateRoot = readObject(input.stateBody, "Vortex merchant state response");
  const state = readObject(stateRoot.data, "Vortex merchant state response data");
  const capabilitiesRoot = readObject(
    input.capabilitiesBody,
    "Vortex merchant capabilities response",
  );
  const capabilities = readObject(
    capabilitiesRoot.data,
    "Vortex merchant capabilities response data",
  );
  const activeCapabilityKeys = readStringArray(
    state.activeCapabilityKeys,
    "Vortex merchant active capability keys",
  );
  const restrictedCapabilityKeys = readStringArray(
    state.restrictedCapabilityKeys,
    "Vortex merchant restricted capability keys",
  );
  const capabilityActiveKeys = readStringArray(
    capabilities.activeCapabilityKeys,
    "Vortex merchant capabilities active keys",
  );
  const capabilityRestrictedKeys = readStringArray(
    capabilities.restrictedCapabilityKeys,
    "Vortex merchant capabilities restricted keys",
  );
  const mergedActiveCapabilityKeys = [
    ...new Set([...activeCapabilityKeys, ...capabilityActiveKeys]),
  ];
  const mergedRestrictedCapabilityKeys = [
    ...new Set([...restrictedCapabilityKeys, ...capabilityRestrictedKeys]),
  ];
  const payoutReadiness = readString(state.payoutReadiness, "Vortex merchant payout readiness");
  const chargesEnabled = readBoolean(state.canAcceptPayments, "Vortex merchant payment readiness");
  const disabledReason =
    readOptionalString(state.payoutBlockReason, "Vortex merchant payout block reason") ??
    (chargesEnabled ? undefined : readString(state.merchantStatus, "Vortex merchant status"));

  return {
    chargesEnabled,
    payoutsEnabled: payoutReadiness === "ready",
    detailsSubmitted:
      readOptionalString(state.onboardingStatus, "Vortex merchant onboarding status") ===
        "approved" || readString(state.merchantStatus, "Vortex merchant status") === "active",
    requirements: {
      currentlyDue: readStringArray(state.openRequirementIds, "Vortex merchant open requirements"),
      eventuallyDue: [],
      pastDue: [],
      ...(disabledReason !== undefined ? { disabledReason } : {}),
    },
    capabilities: {
      cardPayments: chargesEnabled
        ? "active"
        : mapCapabilityStatus(
            mergedActiveCapabilityKeys,
            mergedRestrictedCapabilityKeys,
            "card_payments",
          ),
      transfers: payoutReadiness,
      usBankAccountAchPayments: mapCapabilityStatus(
        mergedActiveCapabilityKeys,
        mergedRestrictedCapabilityKeys,
        "us_bank_account_ach_payments",
      ),
    },
  };
}

async function readRemoteVortexMerchantState(
  merchantAccountId: string,
  fetcher: Fetcher = (input, init) => fetch(input, init),
): Promise<VortexMerchantState> {
  const env = readVortexBillingEnvFromProcess();
  const environment = encodeURIComponent(env.paymentsEnvironment);
  const [stateBody, capabilitiesBody] = await Promise.all([
    requestVortexBillingJson(
      {
        apiBaseUrl: env.apiBaseUrl,
        apiKey: env.apiKey,
        method: "GET",
        path: `/v1/merchant-accounts/${encodeURIComponent(merchantAccountId)}/state?environment=${environment}`,
        failureLabel: "Vortex merchant state refresh",
      },
      fetcher,
    ),
    requestVortexBillingJson(
      {
        apiBaseUrl: env.apiBaseUrl,
        apiKey: env.apiKey,
        method: "GET",
        path: `/v1/merchant-accounts/${encodeURIComponent(merchantAccountId)}/capabilities?environment=${environment}`,
        failureLabel: "Vortex merchant capabilities refresh",
      },
      fetcher,
    ),
  ]);
  return mapVortexState({ stateBody, capabilitiesBody });
}

async function persistVortexMerchantAccount(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  merchantAccountId: string,
  state: VortexMerchantState,
  feeHandling: FeeHandling | undefined,
): Promise<void> {
  await ctx.runMutation(internal.stripe.connect_mutations.upsertStripeAccount, {
    organizationId,
    provider: "vortex",
    stripeAccountId: merchantAccountId,
    vortexMerchantAccountId: merchantAccountId,
    accountType: "standard",
    chargesEnabled: state.chargesEnabled,
    payoutsEnabled: state.payoutsEnabled,
    detailsSubmitted: state.detailsSubmitted,
    requirements: state.requirements,
    capabilities: state.capabilities,
    feeHandling,
    defaultCurrency: "USD",
  });
}

async function createVortexMerchantAccountForOrganization(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  feeHandling: FeeHandling | undefined,
): Promise<CreateVortexMerchantAccountResult> {
  if (!isDocumentPaymentOrganizationAllowlisted(organizationId)) {
    throw new ConvexError("Vortex merchant onboarding is not enabled for this organization");
  }

  const existing = await ctx.runQuery(
    internal.stripe.connect_mutations.getAccountByOrganizationId,
    {
      organizationId,
    },
  );
  if (existing?.provider === "vortex" && existing.vortexMerchantAccountId !== undefined) {
    return {
      merchantAccountId: existing.vortexMerchantAccountId,
      state: {
        chargesEnabled: existing.chargesEnabled,
        payoutsEnabled: existing.payoutsEnabled,
        detailsSubmitted: existing.detailsSubmitted,
        requirements: existing.requirements ?? {
          currentlyDue: [],
          eventuallyDue: [],
          pastDue: [],
        },
        capabilities: existing.capabilities ?? {
          cardPayments: "inactive",
          transfers: "unknown",
        },
      },
    };
  }
  if (existing) {
    throw new ConvexError("A Stripe merchant account already exists for this organization");
  }

  const organization = await ctx.runQuery(internal.organizations.helpers.getOrganizationById, {
    organizationId,
  });
  if (!organization) {
    throw new ConvexError("Organization not found");
  }

  const env = readVortexBillingEnvFromProcess();
  const body: JsonObject = {
    environment: env.paymentsEnvironment,
    // Do NOT send tenantId: Vortex derives the tenant from the API key's org context and rejects
    // a mismatch ("tenantId must match current organization"). Seal's own org id is not the Vortex
    // tenant. externalMerchantRef + metadata.sealOrganizationId carry the Seal linkage instead.
    externalMerchantRef: organizationId,
    displayName: organization.name,
    // Must be a valid Finix business_type enum (Vortex passes legalEntityType through to Finix,
    // which rejects unknown values like "company"). Default to CORPORATION — the entity type the
    // hosted-KYC underwriting dataset is proven against end-to-end to real-Finix charges-ready.
    // TODO(1b-followup): collect the real entity type + entity-type-specific fields during hosted KYC.
    legalEntityType: "CORPORATION",
    country: "USA",
    merchantMode: "processing",
    defaultCurrency: "USD",
    metadata: {
      sourceSystem: env.sourceNamespace,
      sealOrganizationId: organizationId,
    },
  };
  const responseBody = await requestVortexBillingJson(
    {
      apiBaseUrl: env.apiBaseUrl,
      apiKey: env.apiKey,
      path: "/v1/merchant-accounts",
      idempotencyKey: `seal-vortex-merchant:${organizationId}`,
      body,
      failureLabel: "Vortex merchant create",
    },
    (input, init) => fetch(input, init),
  );
  const merchantAccountId = readVortexMerchantAccountId(responseBody);
  const state: VortexMerchantState = {
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    requirements: {
      currentlyDue: [],
      eventuallyDue: [],
      pastDue: [],
      disabledReason: "draft",
    },
    capabilities: {
      cardPayments: "inactive",
      transfers: "unknown",
      usBankAccountAchPayments: "inactive",
    },
  };
  await persistVortexMerchantAccount(ctx, organizationId, merchantAccountId, state, feeHandling);

  return {
    merchantAccountId,
    state,
  };
}

async function refreshVortexMerchantAccountForOrganization(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
): Promise<{ readonly status: "not_connected" | "refreshed" }> {
  const existing = await ctx.runQuery(
    internal.stripe.connect_mutations.getAccountByOrganizationId,
    {
      organizationId,
    },
  );
  if (existing?.provider !== "vortex" || existing.vortexMerchantAccountId === undefined) {
    return { status: "not_connected" };
  }

  const state = await readRemoteVortexMerchantState(existing.vortexMerchantAccountId);
  await persistVortexMerchantAccount(
    ctx,
    organizationId,
    existing.vortexMerchantAccountId,
    state,
    undefined,
  );
  return { status: "refreshed" };
}

async function createVortexOnboardingLinkForOrganization(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
): Promise<CreateVortexOnboardingLinkResult> {
  if (!isDocumentPaymentOrganizationAllowlisted(organizationId)) {
    throw new ConvexError("Vortex merchant onboarding is not enabled for this organization");
  }

  const existing = await ctx.runQuery(
    internal.stripe.connect_mutations.getAccountByOrganizationId,
    {
      organizationId,
    },
  );
  if (existing?.provider !== "vortex" || existing.vortexMerchantAccountId === undefined) {
    throw new ConvexError("Create a Vortex Connect account before starting verification");
  }

  const env = readVortexBillingEnvFromProcess();
  const body: JsonObject = {
    environment: env.paymentsEnvironment,
    createdByRef: `seal:${organizationId}`,
  };
  const responseBody = await requestVortexBillingJson(
    {
      apiBaseUrl: env.apiBaseUrl,
      apiKey: env.apiKey,
      path: `/v1/merchant-accounts/${encodeURIComponent(
        existing.vortexMerchantAccountId,
      )}/onboarding-link`,
      body,
      failureLabel: "Vortex merchant onboarding link create",
    },
    (input, init) => fetch(input, init),
  );

  return readVortexOnboardingLink(responseBody);
}

export const createVortexMerchantAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
    feeHandling: v.optional(v.union(v.literal("absorb"), v.literal("pass_to_recipient"))),
  },
  returns: v.object({
    merchantAccountId: v.string(),
    state: v.object({
      chargesEnabled: v.boolean(),
      payoutsEnabled: v.boolean(),
      detailsSubmitted: v.boolean(),
      requirements: v.object({
        currentlyDue: v.array(v.string()),
        eventuallyDue: v.array(v.string()),
        pastDue: v.array(v.string()),
        disabledReason: v.optional(v.string()),
      }),
      capabilities: v.object({
        cardPayments: v.string(),
        transfers: v.string(),
        usBankAccountAchPayments: v.optional(v.string()),
      }),
    }),
  }),
  handler: async (ctx, args): Promise<CreateVortexMerchantAccountResult> => {
    await resolveAdminMembership(ctx, args.organizationId);
    return await createVortexMerchantAccountForOrganization(
      ctx,
      args.organizationId,
      args.feeHandling,
    );
  },
});

export const createVortexOnboardingLink = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    url: v.string(),
    onboardingSessionId: v.string(),
    expiresAt: v.string(),
  }),
  handler: async (ctx, args): Promise<CreateVortexOnboardingLinkResult> => {
    await resolveAdminMembership(ctx, args.organizationId);
    return await createVortexOnboardingLinkForOrganization(ctx, args.organizationId);
  },
});

export const createVortexMerchantProofAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    merchantAccountId: v.string(),
    state: v.object({
      chargesEnabled: v.boolean(),
      payoutsEnabled: v.boolean(),
      detailsSubmitted: v.boolean(),
      requirements: v.object({
        currentlyDue: v.array(v.string()),
        eventuallyDue: v.array(v.string()),
        pastDue: v.array(v.string()),
        disabledReason: v.optional(v.string()),
      }),
      capabilities: v.object({
        cardPayments: v.string(),
        transfers: v.string(),
        usBankAccountAchPayments: v.optional(v.string()),
      }),
    }),
  }),
  handler: async (ctx, args): Promise<CreateVortexMerchantAccountResult> => {
    return await createVortexMerchantAccountForOrganization(ctx, args.organizationId, undefined);
  },
});

export const refreshVortexMerchantAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    status: v.union(v.literal("not_connected"), v.literal("refreshed")),
  }),
  handler: async (ctx, args): Promise<{ readonly status: "not_connected" | "refreshed" }> => {
    await resolveAdminMembership(ctx, args.organizationId);
    return await refreshVortexMerchantAccountForOrganization(ctx, args.organizationId);
  },
});

export const refreshVortexMerchantProofAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    status: v.union(v.literal("not_connected"), v.literal("refreshed")),
  }),
  handler: async (ctx, args): Promise<{ readonly status: "not_connected" | "refreshed" }> => {
    return await refreshVortexMerchantAccountForOrganization(ctx, args.organizationId);
  },
});
