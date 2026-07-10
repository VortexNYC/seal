import {
  createVortexBillingOpenApiClient,
  type ClientResponse,
  type InvoiceCollectRequest,
  type InvoiceResponse,
  type OpenApiInvoiceTaxResponse,
  type OpenApiTaxAddress,
  type OpenApiTaxBehaviorPolicyRequest,
  type RequestOptions,
  type TaxFinalizeRequest,
  type TaxQuoteRequest,
  type VortexBillingClientOptions,
} from "./openapi-client";

export type VortexBillingTaxCollectionClient = {
  readonly quoteInvoiceTax: (
    params: { readonly invoiceId: string },
    body: TaxQuoteRequest,
    options?: RequestOptions,
  ) => Promise<ClientResponse<OpenApiInvoiceTaxResponse>>;
  readonly finalizeInvoiceTax: (
    params: { readonly invoiceId: string },
    body: TaxFinalizeRequest,
    options?: RequestOptions,
  ) => Promise<ClientResponse<OpenApiInvoiceTaxResponse>>;
  readonly collectInvoice: (
    params: { readonly invoiceId: string },
    body: InvoiceCollectRequest,
    options?: RequestOptions,
  ) => Promise<ClientResponse<InvoiceResponse>>;
};

export type CollectTaxedInvoiceCommand = {
  readonly invoiceId: string;
  readonly customerTaxAddress: OpenApiTaxAddress;
  readonly paymentMethodId?: string;
  readonly taxBehaviorPolicy?: OpenApiTaxBehaviorPolicyRequest;
  readonly requestedByRef?: string;
  readonly finalizedByRef?: string;
  readonly idempotencyKeyPrefix?: string;
};

export type CollectTaxedInvoiceFailedStep = "tax_quote" | "tax_finalize" | "payment_collection";

export type CollectTaxedInvoiceResult = {
  readonly ok: boolean;
  readonly invoiceId: string;
  readonly failedStep: CollectTaxedInvoiceFailedStep | null;
  readonly taxQuote?: ClientResponse<OpenApiInvoiceTaxResponse>;
  readonly taxFinalize?: ClientResponse<OpenApiInvoiceTaxResponse>;
  readonly collection?: ClientResponse<InvoiceResponse>;
};

export function createVortexBillingFacade(client: VortexBillingTaxCollectionClient) {
  return {
    async collectTaxedInvoice(
      command: CollectTaxedInvoiceCommand,
    ): Promise<CollectTaxedInvoiceResult> {
      const idempotencyKeyPrefix = command.idempotencyKeyPrefix ?? `invoice:${command.invoiceId}`;
      const params = { invoiceId: command.invoiceId };
      const taxQuote = await client.quoteInvoiceTax(
        params,
        {
          customerTaxAddress: command.customerTaxAddress,
          taxBehaviorPolicy: command.taxBehaviorPolicy,
          requestedByRef: command.requestedByRef,
        },
        { idempotencyKey: `${idempotencyKeyPrefix}:tax-quote` },
      );
      if (!taxQuote.ok) {
        return {
          ok: false,
          invoiceId: command.invoiceId,
          failedStep: "tax_quote",
          taxQuote,
        };
      }

      const taxFinalize = await client.finalizeInvoiceTax(
        params,
        {
          customerTaxAddress: command.customerTaxAddress,
          taxBehaviorPolicy: command.taxBehaviorPolicy,
          finalizedByRef: command.finalizedByRef ?? command.requestedByRef,
        },
        { idempotencyKey: `${idempotencyKeyPrefix}:tax-finalize` },
      );
      if (!taxFinalize.ok) {
        return {
          ok: false,
          invoiceId: command.invoiceId,
          failedStep: "tax_finalize",
          taxQuote,
          taxFinalize,
        };
      }

      const collection = await client.collectInvoice(
        params,
        { paymentMethodId: command.paymentMethodId },
        { idempotencyKey: `${idempotencyKeyPrefix}:collect` },
      );
      return {
        ok: collection.ok,
        invoiceId: command.invoiceId,
        failedStep: collection.ok ? null : "payment_collection",
        taxQuote,
        taxFinalize,
        collection,
      };
    },
  };
}

export function createVortexBillingDeveloperClient(options: VortexBillingClientOptions) {
  return createVortexBillingFacade(createVortexBillingOpenApiClient(options));
}
