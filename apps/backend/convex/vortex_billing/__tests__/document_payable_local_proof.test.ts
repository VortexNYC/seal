import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import { selectDocumentPaymentProvider } from "../payable_actions";

type TestContext = ReturnType<typeof createTestContext>;
type PaymentType = Doc<"payment_field_configs">["paymentType"];
type ParentVortexField =
  | "vortexRecurringPayableId"
  | "vortexInstallmentPayableId"
  | "vortexDepositBalancePayableId";

type SeededDocumentPayment = {
  readonly organizationId: Id<"organizations">;
  readonly documentId: Id<"documents">;
  readonly configId: Id<"payment_field_configs">;
  readonly recipientEmail: string;
};

type DocumentPayableProofCase = {
  readonly paymentType: PaymentType;
  readonly proofSlug: string;
  readonly parentField: ParentVortexField | undefined;
  readonly seed: (
    t: TestContext,
    args: {
      readonly proofRunId: string;
      readonly lineItemId: string;
      readonly recipientEmail: string;
    },
  ) => Promise<SeededDocumentPayment>;
};

function requirePresent<T>(value: T | null | undefined, label: string): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(`${label} missing`);
  }
  return value;
}

function expectNoLegacyProviderConfigIds(config: Doc<"payment_field_configs">): void {
  expect(config.providerInvoiceId).toBeUndefined();
  expect(config.providerSubscriptionId).toBeUndefined();
  expect(config.providerPaymentIntentId).toBeUndefined();
}

function expectNoLegacyProviderInvoiceIds(invoice: Doc<"document_invoices">): void {
  expect(invoice.providerAccountId).toBeUndefined();
  expect(invoice.providerInvoiceId).toBeUndefined();
  expect(invoice.providerSubscriptionId).toBeUndefined();
  expect(invoice.providerCustomerId).toBeUndefined();
  expect("providerPaymentIntentId" in invoice).toBe(false);
}

function parentMutationArgs(
  parentField: ParentVortexField | undefined,
  parentPayableId: string,
): {
  readonly vortexRecurringPayableId?: string;
  readonly vortexInstallmentPayableId?: string;
  readonly vortexDepositBalancePayableId?: string;
} {
  if (parentField === "vortexRecurringPayableId") {
    return { vortexRecurringPayableId: parentPayableId };
  }
  if (parentField === "vortexInstallmentPayableId") {
    return { vortexInstallmentPayableId: parentPayableId };
  }
  if (parentField === "vortexDepositBalancePayableId") {
    return { vortexDepositBalancePayableId: parentPayableId };
  }
  return {};
}

const documentPayableProofCases: readonly DocumentPayableProofCase[] = [
  {
    paymentType: "one_time",
    proofSlug: "one-time",
    parentField: undefined,
    seed: async (t, args) =>
      await t.mutation(
        internal.vortex_billing.proof_actions.seedVortexOneTimeDocumentPayableProofDocument,
        args,
      ),
  },
  {
    paymentType: "recurring",
    proofSlug: "recurring",
    parentField: "vortexRecurringPayableId",
    seed: async (t, args) =>
      await t.mutation(
        internal.vortex_billing.proof_actions.seedVortexRecurringDocumentPayableProofDocument,
        args,
      ),
  },
  {
    paymentType: "installments",
    proofSlug: "installments",
    parentField: "vortexInstallmentPayableId",
    seed: async (t, args) =>
      await t.mutation(
        internal.vortex_billing.proof_actions.seedVortexInstallmentDocumentPayableProofDocument,
        args,
      ),
  },
  {
    paymentType: "deposit_balance",
    proofSlug: "deposit-balance",
    parentField: "vortexDepositBalancePayableId",
    seed: async (t, args) =>
      await t.mutation(
        internal.vortex_billing.proof_actions.seedVortexDepositBalanceDocumentPayableProofDocument,
        args,
      ),
  },
];

describe("Vortex Billing document payable local proof", () => {
  let t: TestContext;

  beforeEach(() => {
    t = createTestContext();
  });

  for (const proofCase of documentPayableProofCases) {
    test(`${proofCase.paymentType} stores Vortex document payment ids and no legacy provider ids`, async () => {
      const proofRunId = `local-${proofCase.proofSlug}`;
      const recipientEmail = `${proofCase.proofSlug}@seal-vortex-proof.test`;
      const slugForId = proofCase.proofSlug.replace("-", "_");
      const seed = await proofCase.seed(t, {
        proofRunId,
        lineItemId: `line_${slugForId}_first`,
        recipientEmail,
      });
      const vortexPayableId = `payable_${slugForId}_first`;
      const parentPayableId = `parent_${slugForId}_first`;
      const vortexPaymentRequestId = `payment_request_${slugForId}_first`;
      const hostedInvoiceUrl = `https://payments.vortex.test/pay/${proofCase.proofSlug}/first`;

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.payment_fields.mutations.storeVortexPayableIds, {
          configId: seed.configId,
          paymentStatus: "awaiting",
          vortexPayableId,
          ...parentMutationArgs(proofCase.parentField, parentPayableId),
          vortexPaymentRequestId,
          hostedInvoiceUrl,
          customerEmail: seed.recipientEmail,
          customerName: `${proofCase.paymentType} recipient`,
        });
      });

      const state = await t.run(async (ctx) => {
        const config = await ctx.db.get(seed.configId);
        const invoices = await ctx.db
          .query("document_invoices")
          .withIndex("by_vortex_payable", (q) => q.eq("vortexPayableId", vortexPayableId))
          .collect();
        return { config, invoices };
      });

      const config = requirePresent(state.config, "payment config");
      const invoice = requirePresent(state.invoices[0], "document invoice");

      expect(state.invoices).toHaveLength(1);
      expect(
        selectDocumentPaymentProvider(seed.organizationId, [config], {
          VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS: JSON.stringify([seed.organizationId]),
        }),
      ).toBe("vortex_billing");
      expect(config.documentId).toBe(seed.documentId);
      expect(config.paymentType).toBe(proofCase.paymentType);
      expect(config.paymentStatus).toBe("awaiting");
      expect(config.vortexPayableId).toBe(vortexPayableId);
      expect(config.vortexPaymentRequestId).toBe(vortexPaymentRequestId);
      expect(config.hostedInvoiceUrl).toBe(hostedInvoiceUrl);
      expectNoLegacyProviderConfigIds(config);

      if (proofCase.parentField === undefined) {
        expect(config.vortexRecurringPayableId).toBeUndefined();
        expect(config.vortexInstallmentPayableId).toBeUndefined();
        expect(config.vortexDepositBalancePayableId).toBeUndefined();
      } else {
        expect(config[proofCase.parentField]).toBe(parentPayableId);
      }

      expect(invoice).toMatchObject({
        documentId: seed.documentId,
        organizationId: seed.organizationId,
        provider: "vortex_billing",
        vortexPayableId,
        vortexPaymentRequestId,
        status: "open",
        customerEmail: recipientEmail,
        amountDue: config.totalAmountCents,
        currency: "usd",
        hostedInvoiceUrl,
      });
      expectNoLegacyProviderInvoiceIds(invoice);
    });
  }
});
