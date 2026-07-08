import { describe, expect, test } from "vitest";
import type { MerchantAccount } from "../../domain/merchant";
import type { ProviderRegistry } from "../../providers/registry";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type { PaymentsService } from "../payments/service";
import type { RefundsService } from "../refunds/service";
import { createBillingPaymentsService } from "./impl";

function createMerchantAccount(): MerchantAccount {
  return {
    id: "merchant_123",
    environment: "sandbox",
    tenantId: "tenant_123",
    displayName: "Merchant",
    legalEntityType: "business",
    country: "US",
    merchantMode: "processing",
    defaultCurrency: "USD",
    status: "active",
    capabilityStatus: "active",
    processorAccountRefs: [],
    createdAt: "2026-06-05T12:00:00.000Z",
    updatedAt: "2026-06-05T12:00:00.000Z",
  };
}

describe("createBillingPaymentsService", () => {
  test("forwards refund idempotency keys into the refunds service", async () => {
    let forwardedIdempotencyKey: string | undefined;
    const merchant = createMerchantAccount();
    const uow = {
      merchants: {
        async getById() {
          return merchant;
        },
      },
      idempotency: {
        async getByScopeAndKey() {
          return null;
        },
        async save() {},
      },
      async runInTransaction<T>(
        work: (transactionUow: PaymentsUnitOfWork) => Promise<T>,
      ): Promise<T> {
        return work(uow as unknown as PaymentsUnitOfWork);
      },
    } as unknown as PaymentsUnitOfWork;
    const refunds: RefundsService = {
      async createRefund(command) {
        forwardedIdempotencyKey = command.idempotencyKey;
        return {
          id: "refund_123",
          merchantAccountId: command.merchantAccountId,
          paymentId: command.paymentId,
          amount: command.amount,
          currency: "USD",
          status: "succeeded",
          reason: command.reason,
        };
      },
      async getRefund() {
        return null;
      },
    };
    const service = createBillingPaymentsService({
      uow,
      providers: {} as unknown as ProviderRegistry,
      payments: {} as unknown as PaymentsService,
      refunds,
      async listPaymentMethods() {
        return [];
      },
      resolveProviderContext() {
        return { provider: "finix", environment: "sandbox" };
      },
      now: () => "2026-06-05T12:00:00.000Z",
      createId: (prefix) => `${prefix}_test`,
    });

    await service.refundInvoicePayment({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      invoiceId: "invoice_123",
      paymentId: "payment_123",
      amount: 500,
      reason: "requested_by_customer",
      requestedByType: "operator",
      requestedByRef: "operator_123",
      idempotencyKey: "refund_idem_123",
    });

    expect(forwardedIdempotencyKey).toBe("refund_idem_123");
  });
});
