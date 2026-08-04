"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";
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

export function rejectRetiredMerchantSurface(surface: string): never {
  throw new ConvexError(
    `${surface} is retired; use Vortex hosted merchant onboarding`
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
    const result = await ctx.runAction(
      internal.payments.vortex_merchant_actions.createVortexMerchantAccount,
      {
        organizationId: args.organizationId,
        feeHandling: args.feeHandling,
      }
    );

    return {
      processorAccountId: result.merchantAccountId,
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
    const result = await ctx.runAction(
      internal.payments.vortex_merchant_actions.createVortexOnboardingLink,
      {
        organizationId: args.organizationId,
      }
    );

    return {
      url: result.url,
      onboardingSessionId: result.onboardingSessionId,
      expiresAt: result.expiresAt,
    };
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
  handler: async (_ctx, _args): Promise<MerchantOAuthUrlResult> => {
    rejectRetiredMerchantSurface("OAuth merchant onboarding");
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
  handler: async (_ctx, _args): Promise<CreateMerchantAccountResult> => {
    rejectRetiredMerchantSurface("OAuth merchant exchange");
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
  handler: async (_ctx, _args): Promise<MerchantAccountSessionResult> => {
    rejectRetiredMerchantSurface("Embedded merchant account session");
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
    return await ctx.runAction(
      internal.payments.vortex_merchant_actions.refreshVortexMerchantAccount,
      args
    );
  },
});
