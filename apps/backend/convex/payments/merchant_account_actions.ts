"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { isDocumentPaymentOrganizationAllowlisted } from "../vortex_billing/payable_actions";
import { feeHandlingValidator } from "./merchant_account_validators";

type CreateMerchantAccountResult = {
  processorAccountId: string;
};

type MerchantOnboardingLinkResult = {
  url: string;
  onboardingSessionId?: string;
  expiresAt?: string;
};

type MerchantOAuthUrlResult = {
  url: string;
  state: string;
};

type RefreshMerchantAccountResult = {
  status: "not_connected" | "refreshed";
};

type MerchantAccountSessionResult = {
  clientSecret: string;
};

type MerchantSurfaceEnv = {
  readonly [key: string]: string | undefined;
};

export function assertLegacyStripeMerchantSurfaceAllowed(
  organizationId: string,
  surface: string,
  env: MerchantSurfaceEnv = process.env,
): void {
  if (!isDocumentPaymentOrganizationAllowlisted(organizationId, env)) {
    return;
  }

  throw new ConvexError(
    `Legacy Stripe ${surface} is disabled for Vortex document-payment organizations`,
  );
}

export const createMerchantAccount = action({
  args: {
    organizationId: v.id("organizations"),
    feeHandling: v.optional(feeHandlingValidator),
  },
  returns: v.object({
    processorAccountId: v.string(),
  }),
  handler: async (ctx, args): Promise<CreateMerchantAccountResult> => {
    if (isDocumentPaymentOrganizationAllowlisted(args.organizationId)) {
      const result = await ctx.runAction(
        internal.payments.vortex_merchant_actions.createVortexMerchantAccount,
        {
          organizationId: args.organizationId,
          feeHandling: args.feeHandling,
        },
      );

      return {
        processorAccountId: result.merchantAccountId,
      };
    }

    const result = await ctx.runAction(
      internal.stripe.connect_actions.createConnectedAccount,
      args,
    );

    return {
      processorAccountId: result.stripeAccountId,
    };
  },
});

export const createMerchantOnboardingLink = action({
  args: {
    organizationId: v.id("organizations"),
    returnUrl: v.string(),
    refreshUrl: v.string(),
  },
  returns: v.object({
    url: v.string(),
    onboardingSessionId: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<MerchantOnboardingLinkResult> => {
    if (isDocumentPaymentOrganizationAllowlisted(args.organizationId)) {
      const result = await ctx.runAction(
        internal.payments.vortex_merchant_actions.createVortexOnboardingLink,
        {
          organizationId: args.organizationId,
        },
      );

      return {
        url: result.url,
        onboardingSessionId: result.onboardingSessionId,
        expiresAt: result.expiresAt,
      };
    }

    return await ctx.runAction(internal.stripe.connect_actions.createAccountLink, args);
  },
});

export const createMerchantOAuthUrl = action({
  args: {
    organizationId: v.id("organizations"),
    redirectUri: v.string(),
  },
  returns: v.object({
    url: v.string(),
    state: v.string(),
  }),
  handler: async (ctx, args): Promise<MerchantOAuthUrlResult> => {
    assertLegacyStripeMerchantSurfaceAllowed(args.organizationId, "OAuth onboarding");

    return await ctx.runAction(internal.stripe.connect_actions.createConnectOAuthUrl, args);
  },
});

export const exchangeMerchantOAuthCode = action({
  args: {
    organizationId: v.id("organizations"),
    code: v.string(),
    state: v.string(),
  },
  returns: v.object({
    processorAccountId: v.string(),
  }),
  handler: async (ctx, args): Promise<CreateMerchantAccountResult> => {
    assertLegacyStripeMerchantSurfaceAllowed(args.organizationId, "OAuth exchange");

    const result = await ctx.runAction(
      internal.stripe.connect_actions.exchangeConnectOAuthCode,
      args,
    );

    return {
      processorAccountId: result.stripeAccountId,
    };
  },
});

export const createMerchantAccountSession = action({
  args: {
    organizationId: v.id("organizations"),
    components: v.optional(v.array(v.string())),
  },
  returns: v.object({
    clientSecret: v.string(),
  }),
  handler: async (ctx, args): Promise<MerchantAccountSessionResult> => {
    assertLegacyStripeMerchantSurfaceAllowed(args.organizationId, "embedded account session");

    return await ctx.runAction(internal.stripe.connect_actions.createAccountSession, args);
  },
});

export const refreshMerchantAccount = action({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    status: v.union(v.literal("not_connected"), v.literal("refreshed")),
  }),
  handler: async (ctx, args): Promise<RefreshMerchantAccountResult> => {
    const existing = await ctx.runQuery(
      internal.stripe.connect_mutations.getAccountByOrganizationId,
      {
        organizationId: args.organizationId,
      },
    );
    if (existing?.provider === "vortex") {
      return await ctx.runAction(
        internal.payments.vortex_merchant_actions.refreshVortexMerchantAccount,
        args,
      );
    }

    return await ctx.runAction(internal.stripe.connect_actions.refreshConnectedAccount, args);
  },
});
