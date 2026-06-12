/**
 * Payment type declarations bridging Convex backend validators to the frontend.
 *
 * These mirror the backend validator shapes in:
 * - apps/backend/convex/payments/billing_query_validators.ts
 * - apps/backend/convex/payments/merchant_account_validators.ts
 *
 * Frontend components import these types instead of maintaining
 * incomplete local mirrors with unsafe `as` casts.
 */

/* ------------------------------------------------------------------ */
/*  Billing types (billing_query_validators.ts)                       */
/* ------------------------------------------------------------------ */

export interface BillingSubscription {
  readonly status: string;
  readonly currentPeriodStart: number;
  readonly currentPeriodEnd: number;
  readonly cancelAtPeriodEnd: boolean;
  readonly canceledAt?: number;
  readonly trialStart?: number;
  readonly trialEnd?: number;
  readonly tier: string;
  readonly planName: string;
  readonly features: string | null;
  readonly unitAmount: number;
  readonly currency: string;
  readonly interval: string;
  readonly intervalCount: number;
}

export interface AvailablePlanPrice {
  readonly amount: number;
  readonly currency: string;
  readonly lookupKey: string | null;
}

export interface AvailablePlan {
  readonly productId: string;
  readonly name: string;
  readonly description: string | null;
  readonly tier: string | null;
  readonly useType: string | null;
  readonly features: string | null;
  readonly pricing: {
    readonly monthly: AvailablePlanPrice | null;
    readonly yearly: AvailablePlanPrice | null;
  };
}

/* ------------------------------------------------------------------ */
/*  Merchant account types (merchant_account_validators.ts)           */
/* ------------------------------------------------------------------ */

export type FeeHandling = "absorb" | "pass_to_recipient";

export type MerchantConnectionStatus =
  | "not_connected"
  | "pending"
  | "restricted"
  | "connected";

export interface MerchantAccount {
  _id: string;
  processorAccountId: string;
  accountType: "standard" | "express";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  feeHandling: FeeHandling;
  defaultCurrency?: string;
  createdAt?: number;
  updatedAt?: number;
  capabilities?: {
    cardPayments: string;
    transfers: string;
    usBankAccountAchPayments?: string;
  };
  requirements?: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    disabledReason?: string;
  };
}

export interface MerchantAccountResult {
  status: MerchantConnectionStatus;
  account: MerchantAccount | null;
  canManage: boolean;
}
