import type { PaymentMethod } from "../../domain/payment-methods";
import type { PaymentIntent } from "../../domain/payments";
import type { CustomerPaymentReadiness, CustomerPaymentState } from "../../domain/state";

export interface DeriveCustomerPaymentStateInput {
  readonly customerProfileId: string;
  readonly merchantAccountId: string;
  readonly environment: "sandbox" | "production";
  readonly paymentMethods?: readonly PaymentMethod[];
  readonly paymentIntents?: readonly PaymentIntent[];
  readonly generatedAt: string;
}

function deriveReadiness(
  paymentMethods: readonly PaymentMethod[],
  paymentIntents: readonly PaymentIntent[],
): CustomerPaymentReadiness {
  if (paymentIntents.some((paymentIntent) => paymentIntent.status === "requires_action")) {
    return "action_required";
  }

  if (paymentMethods.some((paymentMethod) => paymentMethod.status === "active")) {
    return "ready";
  }

  if (paymentMethods.length > 0) {
    return "blocked";
  }

  return "unknown";
}

export function deriveCustomerPaymentState(
  input: DeriveCustomerPaymentStateInput,
): CustomerPaymentState {
  const paymentMethods = (input.paymentMethods ?? []).filter(
    (paymentMethod) =>
      paymentMethod.ownerType === "customer" &&
      paymentMethod.ownerId === input.customerProfileId &&
      (paymentMethod.merchantAccountId === undefined || paymentMethod.merchantAccountId === input.merchantAccountId),
  );
  const activePaymentMethods = paymentMethods.filter((paymentMethod) => paymentMethod.status === "active");
  const customerPaymentIntents = (input.paymentIntents ?? []).filter(
    (paymentIntent) =>
      paymentIntent.customerProfileId === input.customerProfileId &&
      paymentIntent.merchantAccountId === input.merchantAccountId,
  );
  const latestPaymentIntent = customerPaymentIntents
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  return {
    customerProfileId: input.customerProfileId,
    merchantAccountId: input.merchantAccountId,
    environment: input.environment,
    defaultPaymentMethodId: activePaymentMethods.find((paymentMethod) => paymentMethod.isDefault)?.id,
    activePaymentMethodIds: activePaymentMethods.map((paymentMethod) => paymentMethod.id),
    requiresActionPaymentIntentIds: customerPaymentIntents
      .filter((paymentIntent) => paymentIntent.status === "requires_action")
      .map((paymentIntent) => paymentIntent.id),
    latestPaymentIntentStatus: latestPaymentIntent?.status,
    readiness: deriveReadiness(paymentMethods, customerPaymentIntents),
    generatedAt: input.generatedAt,
  };
}
