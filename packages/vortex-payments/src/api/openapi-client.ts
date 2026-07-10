/* Compatibility HTTP client for existing Vortex Payments proof scripts. Public SDKs are generated under sdks/. */
type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };

export type Metadata = Record<string, string>;
export type CustomerUpsertRequest = {
  readonly email?: string;
  readonly name?: string;
  readonly billingCurrency?: string;
  readonly customerProfileId?: string;
  readonly timezone?: string;
  readonly metadata?: Metadata;
};
export type ProductCreateRequest = {
  readonly productId: string;
  readonly name: string;
  readonly description?: string;
  readonly metadata?: Metadata;
};
export type PriceCreateRequest = {
  readonly priceId: string;
  readonly productId: string;
  readonly name: string;
  readonly priceType: "fixed_recurring" | "usage_metered";
  readonly currency: string;
  readonly billingInterval?: "day" | "week" | "month" | "year";
  readonly billingIntervalCount?: number;
  readonly unitAmount?: number;
  readonly meterId?: string;
  readonly metadata?: Metadata;
};
export type SubscriptionCreateRequest = {
  readonly customerExternalId: string;
  readonly subscriptionExternalId: string;
  readonly planCode: string;
  readonly collectionMode?: "automatic" | "manual";
  readonly items?: readonly JsonObject[];
  readonly trialEndsAt?: string;
  readonly metadata?: Metadata;
};
export type SubscriptionItemChangeRequestItem = {
  readonly priceId: string;
  readonly quantity?: number;
  readonly metadata?: Metadata;
};
export type SubscriptionItemChangePreviewRequest = {
  readonly effectiveAt?: string;
  readonly items: readonly SubscriptionItemChangeRequestItem[];
  readonly requestedByRef?: string;
};
export type SubscriptionChangeRequest = {
  readonly action: "pause" | "resume" | "cancel" | "update_items";
  readonly cancelAt?: string;
  readonly effectiveAt?: string;
  readonly items?: readonly SubscriptionItemChangeRequestItem[];
  readonly requestedByRef?: string;
};
export type CustomerPaymentMethodSetupRequest = {
  readonly billingAccountId?: string;
  readonly methodType?: "card";
  readonly setAsDefault?: boolean;
};
export type CustomerPaymentMethodAttachRequest = {
  readonly billingAccountId?: string;
  readonly paymentMethodSetupSessionId: string;
  readonly setupToken: string;
  readonly setAsDefault?: boolean;
  readonly idempotencyKey?: string;
};
export type CustomerDefaultPaymentMethodRequest = {
  readonly billingAccountId?: string;
  readonly defaultPaymentMethodId: string;
};
export type CustomerPaymentMethodArchiveRequest = {
  readonly billingAccountId?: string;
  readonly reason?: string;
};
export type OpenApiEntitlementSource = "subscription" | "operator" | "promotion";
export type OpenApiGrantEntitlementRequest = {
  readonly customerExternalId: string;
  readonly billingAccountId?: string;
  readonly entitlementKey: string;
  readonly source?: OpenApiEntitlementSource;
  readonly sourceRef?: string;
  readonly metadata?: Metadata;
};
export type OpenApiRevokeEntitlementRequest = {
  readonly customerExternalId: string;
  readonly billingAccountId?: string;
  readonly entitlementKey: string;
  readonly source?: OpenApiEntitlementSource;
  readonly sourceRef?: string;
  readonly reason?: string;
};
export type WebhookEndpointCreateRequest = {
  readonly url: string;
  readonly description?: string;
  readonly eventTypes: readonly string[];
};
export type WebhookEndpointUpdateRequest = {
  readonly url?: string;
  readonly description?: string;
  readonly eventTypes?: readonly string[];
  readonly status?: "active" | "disabled";
};
export type WebhookEndpointTestRequest = {
  readonly eventType: string;
  readonly dispatch?: boolean;
};
export type WebhookEndpointSecretRotateRequest = { readonly gracePeriodSeconds?: number };
export type WebhookEventResendRequest = { readonly endpointId?: string };
export type WebhookDeliveryReplayRequest = {
  readonly replayedByRef?: string;
  readonly dispatch?: boolean;
};
export type WebhookDeliveriesDispatchRequest = {
  readonly deliveryId?: string;
  readonly limit?: number;
  readonly endpointLimit?: number;
};
export type WebhookDeliveriesRedriveRequest = {
  readonly eventId?: string;
  readonly endpointId?: string;
  readonly failureKind?:
    | "endpoint_inactive"
    | "network_error"
    | "rate_limited"
    | "server_error"
    | "client_error"
    | "unknown_error";
  readonly limit?: number;
  readonly replayedByRef?: string;
  readonly dispatch?: boolean;
};
export type WebhookEmptyRequest = Record<string, never>;
export type InvoiceCreateRequest = {
  readonly customerExternalId: string;
  readonly subscriptionExternalId?: string;
  readonly billingAccountId?: string;
  readonly metadata?: Metadata;
};
export type InvoiceFinalizeRequest = { readonly finalizedByRef?: string };
export type OpenApiTaxAddress = {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly country: string;
};
export type OpenApiTaxBehavior = "exclusive" | "inclusive" | "location_based";
export type OpenApiTaxBehaviorPolicyRequest = {
  readonly behavior: OpenApiTaxBehavior;
  readonly locationRef?: string;
};
export type OpenApiTaxBehaviorPolicy = {
  readonly behavior: OpenApiTaxBehavior;
  readonly source: "request" | "request_default" | "location_profile";
  readonly amountIncludesTax: boolean;
  readonly locationRef?: string;
};
export type TaxQuoteRequest = {
  readonly customerTaxAddress: OpenApiTaxAddress;
  readonly taxBehaviorPolicy?: OpenApiTaxBehaviorPolicyRequest;
  readonly requestedByRef?: string;
};
export type TaxFinalizeRequest = {
  readonly customerTaxAddress: OpenApiTaxAddress;
  readonly taxBehaviorPolicy?: OpenApiTaxBehaviorPolicyRequest;
  readonly finalizedByRef?: string;
};
export type OpenApiTaxTransactionStatus =
  | "not_required"
  | "quote_pending"
  | "quoted"
  | "finalization_pending"
  | "finalized"
  | "failed"
  | "voided"
  | "reversed";
export type OpenApiTaxFailureAction =
  | "configure_tax_company"
  | "configure_tax_classification"
  | "configure_tax_location_profile"
  | "collect_customer_address"
  | "retry_quote"
  | "retry_finalize"
  | "retry_reverse"
  | "reconcile_tax_state"
  | "none";
export type OpenApiTaxFailureCode =
  | "tax_company_mapping_missing"
  | "tax_classification_missing"
  | "tax_classification_inactive"
  | "tax_classification_unmapped"
  | "tax_location_profile_missing"
  | "address_missing"
  | "unsupported_jurisdiction"
  | "tax_auth_failed"
  | "tax_timeout"
  | "tax_uncertain"
  | "tax_service_error";
export type OpenApiTaxLineEvidence = {
  readonly sourceLineId: string;
  readonly classificationKey: string;
  readonly classificationLabel: string;
  readonly classificationVersion: number;
  readonly classificationMappingVersion: number;
  readonly taxableAmount: number;
  readonly taxAmount: number;
  readonly taxBehavior: OpenApiTaxBehavior;
  readonly amountIncludesTax: boolean;
};
export type OpenApiTaxJurisdictionEvidence = {
  readonly jurisdictionType: string;
  readonly jurisdictionName: string;
  readonly taxableAmount: number;
  readonly taxAmount: number;
  readonly rate: number;
};
export type OpenApiTaxFailure = {
  readonly code: OpenApiTaxFailureCode;
  readonly message: string;
  readonly nextAction: OpenApiTaxFailureAction;
};
export type OpenApiInvoiceTax = {
  readonly invoiceNumber: string;
  readonly status: OpenApiTaxTransactionStatus;
  readonly currency: string;
  readonly subtotal: number;
  readonly taxTotal: number;
  readonly total: number;
  readonly evidenceVersion: string;
  readonly taxBehaviorPolicy: OpenApiTaxBehaviorPolicy;
  readonly quotedAt?: string;
  readonly finalizedAt?: string;
  readonly lineEvidence: readonly OpenApiTaxLineEvidence[];
  readonly jurisdictionEvidence: readonly OpenApiTaxJurisdictionEvidence[];
  readonly failure?: OpenApiTaxFailure;
};
export type OpenApiInvoiceTaxResponse = {
  readonly data: { readonly tax: OpenApiInvoiceTax; readonly replayed: boolean };
  readonly requestId: string;
};
export type InvoiceRefreshRequest = Record<string, never>;
export type InvoiceVoidRequest = { readonly voidedByRef?: string; readonly reason?: string };
export type InvoiceMarkUncollectibleRequest = {
  readonly markedUncollectibleByRef?: string;
  readonly by?: string;
  readonly reason?: string;
};
export type InvoiceCollectRequest = { readonly paymentMethodId?: string };
export type OpenApiCheckoutSessionLineItemRequest = {
  readonly priceId: string;
  readonly quantity?: number;
  readonly metadata?: Metadata;
};
export type OpenApiCreateCheckoutSessionRequest = {
  readonly mode?: "payment" | "subscription";
  readonly invoiceNumber?: string;
  readonly invoiceNumbers?: readonly string[];
  readonly customerExternalId?: string;
  readonly billingAccountId?: string;
  readonly subscriptionExternalId?: string;
  readonly collectionMode?: "manual" | "automatic";
  readonly startAt?: string;
  readonly lineItems?: readonly OpenApiCheckoutSessionLineItemRequest[];
  readonly paymentRequestId?: string;
  readonly expiresAt?: string;
  readonly createdByRef?: string;
  readonly metadata?: Metadata;
};
export type PaymentRequestCreateRequest = {
  readonly paymentRequestId?: string;
  readonly invoiceNumber?: string;
  readonly invoiceNumbers?: readonly string[];
  readonly createdByRef?: string;
  readonly dueAt?: string;
  readonly expiresAt?: string;
  readonly metadata?: Metadata;
};
export type PaymentRequestLinkCreateRequest = {
  readonly expiresAt?: string;
  readonly createdByRef?: string;
};
export type PaymentRequestCollectRequest = { readonly paymentMethodId?: string };
export type OpenApiCouponTargets = {
  readonly priceIds?: readonly string[];
  readonly meterIds?: readonly string[];
};
export type OpenApiCreateCouponRequest = {
  readonly couponId?: string;
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly discountType: "fixed_amount" | "percentage";
  readonly amount?: number;
  readonly currency?: "USD" | "CAD";
  readonly percentage?: number;
  readonly duration: "once" | "repeating" | "forever";
  readonly durationInBillingPeriods?: number;
  readonly reusable?: boolean;
  readonly targets?: OpenApiCouponTargets;
  readonly expiresAt?: string;
  readonly metadata?: Metadata;
};
export type OpenApiApplyCouponRequest = {
  readonly appliedCouponId?: string;
  readonly customerExternalId: string;
  readonly billingAccountId?: string;
  readonly subscriptionExternalId?: string;
  readonly appliedAt?: string;
  readonly metadata?: Metadata;
};
export type OpenApiTerminateCouponRequest = { readonly terminatedAt?: string };
export type OpenApiTerminateAppliedCouponRequest = { readonly terminatedAt?: string };
export type OpenApiCustomerBalanceLineType = "fixed" | "usage" | "credit" | "adjustment" | "tax";
export type OpenApiCustomerBalanceTargets = {
  readonly lineTypes?: readonly OpenApiCustomerBalanceLineType[];
  readonly priceIds?: readonly string[];
  readonly meterIds?: readonly string[];
};
export type OpenApiGrantCustomerBalanceRequest = {
  readonly entryId?: string;
  readonly currency: string;
  readonly amount: number;
  readonly targets?: OpenApiCustomerBalanceTargets;
  readonly description?: string;
  readonly effectiveAt?: string;
  readonly expiresAt?: string;
  readonly metadata?: Metadata;
};
export type OpenApiGrantCustomerBalanceFromPaymentRequest = {
  readonly entryId?: string;
  readonly paymentId: string;
  readonly targets?: OpenApiCustomerBalanceTargets;
  readonly description?: string;
  readonly effectiveAt?: string;
  readonly expiresAt?: string;
  readonly metadata?: Metadata;
};
export type OpenApiExpireCustomerBalanceRequest = {
  readonly entryId?: string;
  readonly sourceEntryId: string;
  readonly amount?: number;
  readonly description?: string;
  readonly effectiveAt?: string;
  readonly metadata?: Metadata;
};
export type OpenApiReverseCustomerBalanceRequest = {
  readonly entryId?: string;
  readonly sourceEntryId: string;
  readonly amount?: number;
  readonly description?: string;
  readonly effectiveAt?: string;
  readonly metadata?: Metadata;
};
export type OpenApiCreditNoteReason =
  | "duplicated_charge"
  | "product_unsatisfactory"
  | "order_change"
  | "order_cancellation"
  | "fraudulent_charge"
  | "other";
export type CreditNoteCreateLine = {
  readonly invoiceLineId?: string;
  readonly bucket?: "credit" | "refund" | "offset";
  readonly description: string;
  readonly amount: number;
  readonly metadata?: Metadata;
};
export type CreditNoteCreateRequest = {
  readonly creditNoteId?: string;
  readonly invoiceId: string;
  readonly reason: OpenApiCreditNoteReason;
  readonly description?: string;
  readonly creditAmount?: number;
  readonly refundAmount?: number;
  readonly offsetAmount?: number;
  readonly metadata?: Metadata;
  readonly lines: readonly CreditNoteCreateLine[];
};
export type CreditNoteRefundRequest = {
  readonly paymentId: string;
  readonly idempotencyKey?: string;
  readonly customerTaxAddress?: OpenApiTaxAddress;
};
export type CreditNoteRefundReconcileRequest = { readonly paymentsRefundId?: string };
export type ApiWriteEnvelope = {
  readonly data: JsonObject;
  readonly requestId: string;
} & JsonObject;
export type CustomerResponse = ApiWriteEnvelope;
export type ProductResponse = ApiWriteEnvelope;
export type PriceResponse = ApiWriteEnvelope;
export type SubscriptionResponse = ApiWriteEnvelope;
export type SubscriptionItemChangePreviewResponse = ApiWriteEnvelope;
export type SubscriptionChangeResponse = ApiWriteEnvelope;
export type CustomerPaymentMethodsResponse = ApiWriteEnvelope;
export type CustomerPaymentMethodSetupResponse = ApiWriteEnvelope;
export type CustomerPaymentMethodResponse = ApiWriteEnvelope;
export type CustomerPaymentStateResponse = ApiWriteEnvelope;
export type CustomerStateResponse = ApiWriteEnvelope;
export type CustomerAccessResponse = ApiWriteEnvelope;
export type CustomerEntitlementsResponse = ApiWriteEnvelope;
export type EntitlementResponse = ApiWriteEnvelope;
export type MerchantAccountStateResponse = ApiWriteEnvelope;
export type MerchantAccountCapabilitiesResponse = ApiWriteEnvelope;
export type WebhookEventTypesResponse = ApiWriteEnvelope;
export type WebhookEndpointResponse = ApiWriteEnvelope;
export type WebhookEndpointListResponse = ApiWriteEnvelope;
export type WebhookEndpointTestResponse = ApiWriteEnvelope;
export type WebhookEventResponse = ApiWriteEnvelope;
export type WebhookEventListResponse = ApiWriteEnvelope;
export type WebhookDeliveryResponse = ApiWriteEnvelope;
export type WebhookDeliveryListResponse = ApiWriteEnvelope;
export type WebhookDeliveryDispatchResponse = ApiWriteEnvelope;
export type WebhookDeliveryRedriveResponse = ApiWriteEnvelope;
export type InvoicePreviewResponse = ApiWriteEnvelope;
export type InvoiceResponse = ApiWriteEnvelope;
export type PaymentLifecycleResponse = ApiWriteEnvelope;
export type ReceiptListResponse = ApiWriteEnvelope;
export type ReceiptResponse = ApiWriteEnvelope;
export type OpenApiCreateCheckoutSessionResponse = ApiWriteEnvelope;
export type PaymentRequestResponse = ApiWriteEnvelope;
export type PaymentRequestLinkResponse = ApiWriteEnvelope;
export type CouponResponse = ApiWriteEnvelope;
export type CouponApplicationResponse = ApiWriteEnvelope;
export type CouponListResponse = ApiWriteEnvelope;
export type AppliedCouponResponse = ApiWriteEnvelope;
export type AppliedCouponListResponse = ApiWriteEnvelope;
export type CustomerBalanceResponse = ApiWriteEnvelope;
export type CustomerBalanceEntryResponse = ApiWriteEnvelope;
export type CreditNoteResponse = ApiWriteEnvelope;
export type CreditNoteRefundLineageResponse = ApiWriteEnvelope;

export type RequestOptions = { readonly idempotencyKey?: string };
export type ClientResponse<TBody extends Json> = {
  readonly ok: boolean;
  readonly status: number;
  readonly idempotencyKey: string | null;
  readonly body: TBody;
};
export type VortexBillingClientOptions = {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly fetch?: typeof fetch;
};

type OpenApiRequestInput = {
  readonly method: string;
  readonly path: string;
  readonly body?: JsonObject;
  readonly idempotencyKey?: string;
};

type OpenApiRequest = <TBody extends Json>(
  input: OpenApiRequestInput,
) => Promise<ClientResponse<TBody>>;

function createOpenApiRequest(options: VortexBillingClientOptions): OpenApiRequest {
  const fetcher = options.fetch ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/$/u, "");

  return async function request<TBody extends Json>(
    input: OpenApiRequestInput,
  ): Promise<ClientResponse<TBody>> {
    const headers = new Headers();
    headers.set("Authorization", `Bearer ${options.apiKey}`);
    if (input.idempotencyKey !== undefined) {
      headers.set("Idempotency-Key", input.idempotencyKey);
    }
    if (input.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetcher(`${baseUrl}${input.path}`, {
      method: input.method,
      headers,
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
    const text = await response.text();
    const parsed = (text.length === 0 ? null : JSON.parse(text)) as TBody;
    return {
      ok: response.ok,
      status: response.status,
      idempotencyKey: input.idempotencyKey ?? null,
      body: parsed,
    };
  };
}

function createOpenApiCouponMethods(request: OpenApiRequest) {
  return {
    async applyCoupon(
      params: { readonly couponId: string },
      body: OpenApiApplyCouponRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CouponApplicationResponse>> {
      return request({
        method: "POST",
        path: `/v1/coupons/${encodeURIComponent(params.couponId)}/apply`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async createCoupon(
      body: OpenApiCreateCouponRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CouponResponse>> {
      return request({
        method: "POST",
        path: "/v1/coupons",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getAppliedCoupon(
      params: { readonly appliedCouponId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<AppliedCouponResponse>> {
      return request({
        method: "GET",
        path: `/v1/applied-coupons/${encodeURIComponent(params.appliedCouponId)}`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getCoupon(
      params: { readonly couponId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<CouponResponse>> {
      return request({
        method: "GET",
        path: `/v1/coupons/${encodeURIComponent(params.couponId)}`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async listAppliedCoupons(
      options?: RequestOptions,
    ): Promise<ClientResponse<AppliedCouponListResponse>> {
      return request({
        method: "GET",
        path: "/v1/applied-coupons",
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async listCoupons(options?: RequestOptions): Promise<ClientResponse<CouponListResponse>> {
      return request({
        method: "GET",
        path: "/v1/coupons",
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async terminateAppliedCoupon(
      params: { readonly appliedCouponId: string },
      body: OpenApiTerminateAppliedCouponRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<AppliedCouponResponse>> {
      return request({
        method: "POST",
        path: `/v1/applied-coupons/${encodeURIComponent(params.appliedCouponId)}/terminate`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async terminateCoupon(
      params: { readonly couponId: string },
      body: OpenApiTerminateCouponRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CouponResponse>> {
      return request({
        method: "POST",
        path: `/v1/coupons/${encodeURIComponent(params.couponId)}/terminate`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiCustomerProfileMethods(request: OpenApiRequest) {
  return {
    async getCustomerState(
      params: { readonly customerId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerStateResponse>> {
      return request({
        method: "GET",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/state`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async upsertCustomer(
      params: { readonly customerId: string },
      body: CustomerUpsertRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerResponse>> {
      return request({
        method: "PUT",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiCustomerPaymentMethodMethods(request: OpenApiRequest) {
  return {
    async archiveCustomerPaymentMethod(
      params: { readonly customerId: string; readonly paymentMethodId: string },
      body: CustomerPaymentMethodArchiveRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerPaymentMethodResponse>> {
      return request({
        method: "POST",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/payment-methods/${encodeURIComponent(params.paymentMethodId)}/archive`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async attachCustomerPaymentMethod(
      params: { readonly customerId: string },
      body: CustomerPaymentMethodAttachRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerPaymentMethodResponse>> {
      return request({
        method: "POST",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/payment-methods`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async createCustomerPaymentMethodSetup(
      params: { readonly customerId: string },
      body: CustomerPaymentMethodSetupRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerPaymentMethodSetupResponse>> {
      return request({
        method: "POST",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/payment-method-setup`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getCustomerPaymentState(
      params: { readonly customerId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerPaymentStateResponse>> {
      return request({
        method: "GET",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/payment-state`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async listCustomerPaymentMethods(
      params: { readonly customerId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerPaymentMethodsResponse>> {
      return request({
        method: "GET",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/payment-methods`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async setCustomerDefaultPaymentMethod(
      params: { readonly customerId: string },
      body: CustomerDefaultPaymentMethodRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerPaymentMethodResponse>> {
      return request({
        method: "PATCH",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/default-payment-method`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiCustomerBalanceMethods(request: OpenApiRequest) {
  return {
    async expireCustomerBalance(
      params: { readonly customerId: string },
      body: OpenApiExpireCustomerBalanceRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerBalanceEntryResponse>> {
      return request({
        method: "POST",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/balance/expire`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getCustomerBalance(
      params: { readonly customerId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerBalanceResponse>> {
      return request({
        method: "GET",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/balance`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async grantCustomerBalance(
      params: { readonly customerId: string },
      body: OpenApiGrantCustomerBalanceRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerBalanceEntryResponse>> {
      return request({
        method: "POST",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/balance/grant`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async grantCustomerBalanceFromPayment(
      params: { readonly customerId: string },
      body: OpenApiGrantCustomerBalanceFromPaymentRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerBalanceEntryResponse>> {
      return request({
        method: "POST",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/balance/grant-from-payment`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async reverseCustomerBalance(
      params: { readonly customerId: string },
      body: OpenApiReverseCustomerBalanceRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerBalanceEntryResponse>> {
      return request({
        method: "POST",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/balance/reverse`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiCustomerEntitlementMethods(request: OpenApiRequest) {
  return {
    async checkCustomerAccess(
      params: { readonly customerId: string; readonly key: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerAccessResponse>> {
      return request({
        method: "GET",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/access?${new URLSearchParams({ key: params.key }).toString()}`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getCustomerEntitlements(
      params: { readonly customerId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<CustomerEntitlementsResponse>> {
      return request({
        method: "GET",
        path: `/v1/customers/${encodeURIComponent(params.customerId)}/entitlements`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async grantEntitlement(
      body: OpenApiGrantEntitlementRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<EntitlementResponse>> {
      return request({
        method: "POST",
        path: "/v1/entitlements/grant",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async revokeEntitlement(
      body: OpenApiRevokeEntitlementRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<EntitlementResponse>> {
      return request({
        method: "POST",
        path: "/v1/entitlements/revoke",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiCatalogSubscriptionMethods(request: OpenApiRequest) {
  return {
    async changeSubscription(
      params: { readonly subscriptionId: string },
      body: SubscriptionChangeRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<SubscriptionChangeResponse>> {
      return request({
        method: "POST",
        path: `/v1/subscriptions/${encodeURIComponent(params.subscriptionId)}/change`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async createPrice(
      body: PriceCreateRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<PriceResponse>> {
      return request({
        method: "POST",
        path: "/v1/prices",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async createProduct(
      body: ProductCreateRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<ProductResponse>> {
      return request({
        method: "POST",
        path: "/v1/products",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async createSubscription(
      body: SubscriptionCreateRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<SubscriptionResponse>> {
      return request({
        method: "POST",
        path: "/v1/subscriptions",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async previewSubscriptionItemChange(
      params: { readonly subscriptionId: string },
      body: SubscriptionItemChangePreviewRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<SubscriptionItemChangePreviewResponse>> {
      return request({
        method: "POST",
        path: `/v1/subscriptions/${encodeURIComponent(params.subscriptionId)}/change/preview`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiMerchantAccountMethods(request: OpenApiRequest) {
  return {
    async getMerchantAccountCapabilities(
      params: { readonly merchantAccountId: string; readonly environment: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<MerchantAccountCapabilitiesResponse>> {
      return request({
        method: "GET",
        path: `/v1/merchant-accounts/${encodeURIComponent(params.merchantAccountId)}/capabilities?${new URLSearchParams({ environment: params.environment }).toString()}`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getMerchantAccountState(
      params: { readonly merchantAccountId: string; readonly environment: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<MerchantAccountStateResponse>> {
      return request({
        method: "GET",
        path: `/v1/merchant-accounts/${encodeURIComponent(params.merchantAccountId)}/state?${new URLSearchParams({ environment: params.environment }).toString()}`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiInvoiceMethods(request: OpenApiRequest) {
  return {
    async collectInvoice(
      params: { readonly invoiceId: string },
      body: InvoiceCollectRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<InvoiceResponse>> {
      return request({
        method: "POST",
        path: `/v1/invoices/${encodeURIComponent(params.invoiceId)}/collect`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async createInvoice(
      body: InvoiceCreateRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<InvoiceResponse>> {
      return request({
        method: "POST",
        path: "/v1/invoices",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async finalizeInvoice(
      params: { readonly invoiceId: string },
      body: InvoiceFinalizeRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<InvoiceResponse>> {
      return request({
        method: "POST",
        path: `/v1/invoices/${encodeURIComponent(params.invoiceId)}/finalize`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getInvoice(
      params: { readonly invoiceId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<InvoiceResponse>> {
      return request({
        method: "GET",
        path: `/v1/invoices/${encodeURIComponent(params.invoiceId)}`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getInvoicePaymentLifecycle(
      params: { readonly invoiceId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<PaymentLifecycleResponse>> {
      return request({
        method: "GET",
        path: `/v1/invoices/${encodeURIComponent(params.invoiceId)}/payment-lifecycle`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async listInvoiceReceipts(
      params: { readonly invoiceId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<ReceiptListResponse>> {
      return request({
        method: "GET",
        path: `/v1/invoices/${encodeURIComponent(params.invoiceId)}/receipts`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiInvoiceActionMethods(request: OpenApiRequest) {
  return {
    async markInvoiceUncollectible(
      params: { readonly invoiceId: string },
      body: InvoiceMarkUncollectibleRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<InvoiceResponse>> {
      return request({
        method: "POST",
        path: `/v1/invoices/${encodeURIComponent(params.invoiceId)}/mark-uncollectible`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async previewInvoice(
      body: InvoiceCreateRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<InvoicePreviewResponse>> {
      return request({
        method: "POST",
        path: "/v1/invoices/preview",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async refreshInvoice(
      params: { readonly invoiceId: string },
      body: InvoiceRefreshRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<InvoiceResponse>> {
      return request({
        method: "POST",
        path: `/v1/invoices/${encodeURIComponent(params.invoiceId)}/refresh`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async voidInvoice(
      params: { readonly invoiceId: string },
      body: InvoiceVoidRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<InvoiceResponse>> {
      return request({
        method: "DELETE",
        path: `/v1/invoices/${encodeURIComponent(params.invoiceId)}/void`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiInvoiceTaxMethods(request: OpenApiRequest) {
  return {
    async finalizeInvoiceTax(
      params: { readonly invoiceId: string },
      body: TaxFinalizeRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<OpenApiInvoiceTaxResponse>> {
      return request({
        method: "POST",
        path: `/v1/invoices/${encodeURIComponent(params.invoiceId)}/tax/finalize`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async quoteInvoiceTax(
      params: { readonly invoiceId: string },
      body: TaxQuoteRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<OpenApiInvoiceTaxResponse>> {
      return request({
        method: "POST",
        path: `/v1/invoices/${encodeURIComponent(params.invoiceId)}/tax/quote`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiPaymentRequestMethods(request: OpenApiRequest) {
  return {
    async collectPaymentRequest(
      params: { readonly paymentRequestId: string },
      body: PaymentRequestCollectRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<PaymentRequestResponse>> {
      return request({
        method: "POST",
        path: `/v1/payment-requests/${encodeURIComponent(params.paymentRequestId)}/collect`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async createCheckoutSession(
      body: OpenApiCreateCheckoutSessionRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<OpenApiCreateCheckoutSessionResponse>> {
      return request({
        method: "POST",
        path: "/v1/checkout/sessions",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async createPaymentRequest(
      body: PaymentRequestCreateRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<PaymentRequestResponse>> {
      return request({
        method: "POST",
        path: "/v1/payment-requests",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async createPaymentRequestLink(
      params: { readonly paymentRequestId: string },
      body: PaymentRequestLinkCreateRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<PaymentRequestLinkResponse>> {
      return request({
        method: "POST",
        path: `/v1/payment-requests/${encodeURIComponent(params.paymentRequestId)}/link`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getPaymentReceipt(
      params: { readonly receiptId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<ReceiptResponse>> {
      return request({
        method: "GET",
        path: `/v1/payment-receipts/${encodeURIComponent(params.receiptId)}`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getPaymentRequest(
      params: { readonly paymentRequestId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<PaymentRequestResponse>> {
      return request({
        method: "GET",
        path: `/v1/payment-requests/${encodeURIComponent(params.paymentRequestId)}`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async listPaymentReceipts(
      options?: RequestOptions,
    ): Promise<ClientResponse<ReceiptListResponse>> {
      return request({
        method: "GET",
        path: "/v1/payment-receipts",
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiWebhookMethods(request: OpenApiRequest) {
  return {
    async createWebhookEndpoint(
      body: WebhookEndpointCreateRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookEndpointResponse>> {
      return request({
        method: "POST",
        path: "/v1/webhook-endpoints",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async deleteWebhookEndpoint(
      params: { readonly endpointId: string },
      body: WebhookEmptyRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookEndpointResponse>> {
      return request({
        method: "DELETE",
        path: `/v1/webhook-endpoints/${encodeURIComponent(params.endpointId)}`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async dispatchWebhookDeliveries(
      body: WebhookDeliveriesDispatchRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookDeliveryDispatchResponse>> {
      return request({
        method: "POST",
        path: "/v1/webhook-deliveries/dispatch",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getWebhookDelivery(
      params: { readonly deliveryId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookDeliveryResponse>> {
      return request({
        method: "GET",
        path: `/v1/webhook-deliveries/${encodeURIComponent(params.deliveryId)}`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getWebhookEvent(
      params: { readonly eventId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookEventResponse>> {
      return request({
        method: "GET",
        path: `/v1/events/${encodeURIComponent(params.eventId)}`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async listWebhookDeliveries(
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookDeliveryListResponse>> {
      return request({
        method: "GET",
        path: "/v1/webhook-deliveries",
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async listWebhookEndpoints(
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookEndpointListResponse>> {
      return request({
        method: "GET",
        path: "/v1/webhook-endpoints",
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async listWebhookEvents(
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookEventListResponse>> {
      return request({
        method: "GET",
        path: "/v1/events",
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async listWebhookEventTypes(
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookEventTypesResponse>> {
      return request({
        method: "GET",
        path: "/v1/webhook-event-types",
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiWebhookActionMethods(request: OpenApiRequest) {
  return {
    async redriveWebhookDeliveries(
      body: WebhookDeliveriesRedriveRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookDeliveryRedriveResponse>> {
      return request({
        method: "POST",
        path: "/v1/webhook-deliveries/redrive",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async replayWebhookDelivery(
      params: { readonly deliveryId: string },
      body: WebhookDeliveryReplayRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookDeliveryResponse>> {
      return request({
        method: "POST",
        path: `/v1/webhook-deliveries/${encodeURIComponent(params.deliveryId)}/replay`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async resendWebhookEvent(
      params: { readonly eventId: string },
      body: WebhookEventResendRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookEventResponse>> {
      return request({
        method: "POST",
        path: `/v1/events/${encodeURIComponent(params.eventId)}/resend`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async rotateWebhookEndpointSecret(
      params: { readonly endpointId: string },
      body: WebhookEndpointSecretRotateRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookEndpointResponse>> {
      return request({
        method: "POST",
        path: `/v1/webhook-endpoints/${encodeURIComponent(params.endpointId)}/rotate-secret`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async testWebhookEndpoint(
      params: { readonly endpointId: string },
      body: WebhookEndpointTestRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookEndpointTestResponse>> {
      return request({
        method: "POST",
        path: `/v1/webhook-endpoints/${encodeURIComponent(params.endpointId)}/test`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async updateWebhookEndpoint(
      params: { readonly endpointId: string },
      body: WebhookEndpointUpdateRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<WebhookEndpointResponse>> {
      return request({
        method: "PATCH",
        path: `/v1/webhook-endpoints/${encodeURIComponent(params.endpointId)}`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

function createOpenApiCreditNoteMethods(request: OpenApiRequest) {
  return {
    async createCreditNote(
      body: CreditNoteCreateRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CreditNoteResponse>> {
      return request({
        method: "POST",
        path: "/v1/credit-notes",
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getCreditNote(
      params: { readonly creditNoteId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<CreditNoteResponse>> {
      return request({
        method: "GET",
        path: `/v1/credit-notes/${encodeURIComponent(params.creditNoteId)}`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async getCreditNoteRefundLineage(
      params: { readonly creditNoteId: string },
      options?: RequestOptions,
    ): Promise<ClientResponse<CreditNoteRefundLineageResponse>> {
      return request({
        method: "GET",
        path: `/v1/credit-notes/${encodeURIComponent(params.creditNoteId)}/refund-lineage`,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async reconcileCreditNoteRefund(
      params: { readonly creditNoteId: string },
      body: CreditNoteRefundReconcileRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CreditNoteRefundLineageResponse>> {
      return request({
        method: "POST",
        path: `/v1/credit-notes/${encodeURIComponent(params.creditNoteId)}/reconcile-refund`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
    async refundCreditNote(
      params: { readonly creditNoteId: string },
      body: CreditNoteRefundRequest,
      options?: RequestOptions,
    ): Promise<ClientResponse<CreditNoteResponse>> {
      return request({
        method: "POST",
        path: `/v1/credit-notes/${encodeURIComponent(params.creditNoteId)}/refund`,
        body,
        idempotencyKey: options?.idempotencyKey,
      });
    },
  };
}

export function createVortexBillingOpenApiClient(options: VortexBillingClientOptions) {
  const request = createOpenApiRequest(options);

  return {
    ...createOpenApiCouponMethods(request),
    ...createOpenApiCustomerProfileMethods(request),
    ...createOpenApiCustomerPaymentMethodMethods(request),
    ...createOpenApiCustomerBalanceMethods(request),
    ...createOpenApiCustomerEntitlementMethods(request),
    ...createOpenApiCatalogSubscriptionMethods(request),
    ...createOpenApiMerchantAccountMethods(request),
    ...createOpenApiInvoiceMethods(request),
    ...createOpenApiInvoiceActionMethods(request),
    ...createOpenApiInvoiceTaxMethods(request),
    ...createOpenApiPaymentRequestMethods(request),
    ...createOpenApiWebhookMethods(request),
    ...createOpenApiWebhookActionMethods(request),
    ...createOpenApiCreditNoteMethods(request),
  };
}
