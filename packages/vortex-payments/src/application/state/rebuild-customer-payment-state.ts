import type { CustomerProfileId, Environment, MerchantAccountId } from "../../domain/common";
import type { PaymentMethod } from "../../domain/payment-methods";
import type { CustomerPaymentState } from "../../domain/state";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { deriveCustomerPaymentState } from "./derive-customer-payment-state";

function normalizeCustomerDefaultPaymentMethod(
  paymentMethods: readonly PaymentMethod[],
  merchantAccountId: MerchantAccountId,
  generatedAt: string,
): readonly PaymentMethod[] {
  const customerMethods = paymentMethods.filter(
    (paymentMethod) =>
      paymentMethod.ownerType === "customer" &&
      (paymentMethod.merchantAccountId === undefined ||
        paymentMethod.merchantAccountId === merchantAccountId),
  );
  const activeDefaults = customerMethods.filter(
    (paymentMethod) => paymentMethod.status === "active" && paymentMethod.isDefault,
  );

  if (activeDefaults.length === 1) {
    return paymentMethods;
  }

  const fallbackDefaultId =
    activeDefaults[0]?.id ??
    customerMethods.find((paymentMethod) => paymentMethod.status === "active")?.id;

  return paymentMethods.map((paymentMethod) => {
    if (
      paymentMethod.ownerType !== "customer" ||
      (paymentMethod.merchantAccountId !== undefined &&
        paymentMethod.merchantAccountId !== merchantAccountId)
    ) {
      return paymentMethod;
    }

    const nextIsDefault =
      paymentMethod.status === "active" && paymentMethod.id === fallbackDefaultId;
    if (paymentMethod.isDefault === nextIsDefault) {
      return paymentMethod;
    }

    return {
      ...paymentMethod,
      isDefault: nextIsDefault,
      updatedAt: generatedAt,
    };
  });
}

export async function rebuildAndSaveCustomerPaymentState(
  uow: PaymentsUnitOfWork,
  input: {
    readonly environment: Environment;
    readonly merchantAccountId: MerchantAccountId;
    readonly customerProfileId: CustomerProfileId;
    readonly generatedAt: string;
  },
): Promise<CustomerPaymentState> {
  const paymentMethods = normalizeCustomerDefaultPaymentMethod(
    await uow.paymentMethods.listByOwner(input.environment, "customer", input.customerProfileId),
    input.merchantAccountId,
    input.generatedAt,
  );
  const paymentIntents = await uow.paymentIntents.listByCustomerProfile(
    input.environment,
    input.merchantAccountId,
    input.customerProfileId,
  );

  for (const paymentMethod of paymentMethods) {
    await uow.paymentMethods.save(paymentMethod);
  }

  const state = deriveCustomerPaymentState({
    customerProfileId: input.customerProfileId,
    merchantAccountId: input.merchantAccountId,
    environment: input.environment,
    paymentMethods,
    paymentIntents,
    generatedAt: input.generatedAt,
  });
  await uow.customerStates.save(state);
  return state;
}
