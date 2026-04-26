import type Stripe from "stripe";

/**
 * Search for an existing customer by email on a connected account, or create one if not found.
 * This prevents customer duplication when creating multiple invoices for the same recipient.
 */
export async function getOrCreateConnectedCustomer(
  stripe: Stripe,
  stripeAccountId: string,
  email: string,
  name?: string,
): Promise<Stripe.Customer> {
  // Search for existing customer by email on the connected account
  const existingCustomers = await stripe.customers.list(
    {
      email,
      limit: 1,
    },
    { stripeAccount: stripeAccountId },
  );

  if (existingCustomers.data.length > 0) {
    const existing = existingCustomers.data[0]!;  // Length > 0 checked above
    // Update name if provided and different
    if (name && existing.name !== name) {
      return stripe.customers.update(existing.id, { name }, { stripeAccount: stripeAccountId });
    }
    return existing;
  }

  // Create new customer if none exists
  return stripe.customers.create(
    {
      email,
      name: name ?? undefined,
    },
    { stripeAccount: stripeAccountId },
  );
}

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
  // Account has a disabled reason - restricted
  if (account.requirements?.disabledReason) {
    return "restricted";
  }

  // Onboarding not complete or has pending requirements
  if (!account.detailsSubmitted || (account.requirements?.currentlyDue?.length ?? 0) > 0) {
    return "pending";
  }

  // Charges not enabled - restricted (cannot accept payments)
  if (!account.chargesEnabled) {
    return "restricted";
  }

  // chargesEnabled is the primary requirement for accepting payments.
  // payoutsEnabled may be pending (bank verification) but account is usable.
  return "connected";
}
