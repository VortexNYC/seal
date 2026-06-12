import { describe, expect, test } from "vitest";
import type { MerchantAccountSnapshot } from "../../application/merchant-accounts/contracts";
import type { MerchantAccountsService } from "../../application/merchant-accounts/service";
import { MerchantAccountsServiceError } from "../../application/merchant-accounts/impl";
import { createMerchantAccountsHttpHandlers } from "./merchant-accounts";

function merchantSnapshot(overrides: Partial<MerchantAccountSnapshot> = {}): MerchantAccountSnapshot {
  return {
    id: "ma_123",
    environment: "sandbox",
    tenantId: "tenant_123",
    displayName: "Acme",
    legalEntityType: "company",
    country: "US",
    merchantMode: "processing",
    defaultCurrency: "USD",
    status: "draft",
    capabilityStatus: "unknown",
    taxIdentity: {
      associatedIdentityCount: 0,
      beneficialOwnerCount: 0,
      controlPersonCount: 0,
      representativeCount: 0,
    },
    settlementAccount: {
      present: false,
    },
    createdAt: "2026-05-14T18:00:00.000Z",
    updatedAt: "2026-05-14T18:00:00.000Z",
    ...overrides,
  };
}

describe("createMerchantAccountsHttpHandlers", () => {
  test("returns success response for created merchant account", async () => {
    const service: MerchantAccountsService = {
      async createMerchantAccount() {
        return merchantSnapshot();
      },
      async listMerchantAccounts() {
        return [];
      },
      async getMerchantAccount() {
        return null;
      },
      async updateMerchantAccount() {
        throw new Error("unused");
      },
    };

    const handlers = createMerchantAccountsHttpHandlers({
      service,
      createRequestId: () => "req_123",
    });

    const response = await handlers.createMerchantAccount({
      body: {
        environment: "sandbox",
        tenantId: "tenant_123",
        displayName: "Acme",
        legalEntityType: "company",
        country: "US",
        merchantMode: "processing",
        defaultCurrency: "USD",
      },
    });

    expect(response.status).toBe(201);
    if (response.body.requestId !== "req_123") {
      throw new Error("expected requestId");
    }
  });

  test("returns success response for merchant account list", async () => {
    const service: MerchantAccountsService = {
      async createMerchantAccount() {
        throw new Error("unused");
      },
      async listMerchantAccounts() {
        return [merchantSnapshot()];
      },
      async getMerchantAccount() {
        return null;
      },
      async updateMerchantAccount() {
        throw new Error("unused");
      },
    };

    const handlers = createMerchantAccountsHttpHandlers({
      service,
      createRequestId: () => "req_list_123",
    });

    const response = await handlers.listMerchantAccounts({
      body: {
        environment: "sandbox",
        tenantId: "tenant_123",
      },
    });

    expect(response.status).toBe(200);
    if (response.body.requestId !== "req_list_123") {
      throw new Error("expected requestId");
    }
  });

  test("returns success response for updated merchant account", async () => {
    const service: MerchantAccountsService = {
      async createMerchantAccount() {
        throw new Error("unused");
      },
      async listMerchantAccounts() {
        return [];
      },
      async getMerchantAccount() {
        return null;
      },
      async updateMerchantAccount() {
        return merchantSnapshot({
          email: undefined,
          updatedAt: "2026-05-14T19:00:00.000Z",
        });
      },
    };

    const handlers = createMerchantAccountsHttpHandlers({
      service,
      createRequestId: () => "req_update_123",
    });

    const response = await handlers.updateMerchantAccount({
      body: {
        environment: "sandbox",
        merchantAccountId: "ma_123",
        email: null,
      },
    });

    expect(response.status).toBe(200);
    if (response.body.requestId !== "req_update_123") {
      throw new Error("expected requestId");
    }
  });

  test("maps service error to http error", async () => {
    const service: MerchantAccountsService = {
      async createMerchantAccount() {
        throw new MerchantAccountsServiceError("not_found", "merchant account not found");
      },
      async listMerchantAccounts() {
        return [];
      },
      async getMerchantAccount() {
        return null;
      },
      async updateMerchantAccount() {
        throw new Error("unused");
      },
    };

    const handlers = createMerchantAccountsHttpHandlers({
      service,
      createRequestId: () => "req_456",
    });

    const response = await handlers.createMerchantAccount({
      body: {
        environment: "sandbox",
        tenantId: "tenant_123",
        displayName: "Acme",
        legalEntityType: "company",
        country: "US",
        merchantMode: "processing",
        defaultCurrency: "USD",
      },
    });

    expect(response).toEqual({
      status: 404,
      body: {
        code: "not_found",
        category: "merchant_accounts_service",
        message: "merchant account not found",
        actionRequired: false,
        retryable: false,
        requestId: "req_456",
      },
    });
  });
});
