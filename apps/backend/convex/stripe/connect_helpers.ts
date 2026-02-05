import type Stripe from "stripe";

export type StripeRequirements = {
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  disabledReason?: string;
};

export type StripeCapabilities = {
  cardPayments: string;
  transfers: string;
  usBankAccountAchPayments?: string;
};

export function mapStripeRequirements(account: Stripe.Account): StripeRequirements | undefined {
  const requirements = account.requirements;
  if (!requirements) {
    return undefined;
  }

  return {
    currentlyDue: requirements.currently_due ?? [],
    eventuallyDue: requirements.eventually_due ?? [],
    pastDue: requirements.past_due ?? [],
    disabledReason: requirements.disabled_reason ?? undefined,
  };
}

export function mapStripeCapabilities(account: Stripe.Account): StripeCapabilities | undefined {
  const capabilities = account.capabilities;
  if (!capabilities) {
    return undefined;
  }

  return {
    cardPayments: capabilities.card_payments ?? "inactive",
    transfers: capabilities.transfers ?? "inactive",
    usBankAccountAchPayments: capabilities.us_bank_account_ach_payments ?? undefined,
  };
}

export function getConnectionStatus(account: {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements?: StripeRequirements;
}): "pending" | "restricted" | "connected" {
  if (!account.detailsSubmitted || (account.requirements?.currentlyDue?.length ?? 0) > 0) {
    return "pending";
  }

  if (!account.chargesEnabled || (account.requirements?.disabledReason ?? undefined)) {
    return "restricted";
  }

  if (account.payoutsEnabled && account.chargesEnabled) {
    return "connected";
  }

  return "pending";
}
