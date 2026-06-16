import { describe, expect, test } from "vitest";
import type { CustomersService } from "../../application/customers/service";
import { CustomersServiceError } from "../../application/customers/impl";
import { createCustomersHttpHandlers } from "./customers";

describe("createCustomersHttpHandlers", () => {
  test("returns success response for create customer", async () => {
    const service: CustomersService = {
      async createCustomerProfile() {
        return {
          id: "cust_123",
          environment: "sandbox",
          merchantAccountId: "merchant_123",
          name: "Customer",
          email: "customer@example.com",
          phone: "5551112222",
        };
      },
      async getCustomerProfile() { return null; },
      async updateCustomerProfile() {
        throw new Error("unused");
      },
    };

    const handlers = createCustomersHttpHandlers({ service, createRequestId: () => "req_123" });
    const response = await handlers.createCustomerProfile({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        name: "Customer",
      },
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        id: "cust_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        name: "Customer",
        email: "customer@example.com",
        phone: "5551112222",
      },
      requestId: "req_123",
    });
  });

  test("maps service error to http error", async () => {
    const service: CustomersService = {
      async createCustomerProfile() {
        throw new CustomersServiceError("not_found", "merchant account not found");
      },
      async getCustomerProfile() { return null; },
      async updateCustomerProfile() {
        throw new Error("unused");
      },
    };

    const handlers = createCustomersHttpHandlers({ service, createRequestId: () => "req_456" });
    const response = await handlers.createCustomerProfile({
      body: {
        environment: "sandbox",
        merchantAccountId: "merchant_123",
      },
    });

    expect(response).toEqual({
      status: 404,
      body: {
        code: "not_found",
        category: "customers_service",
        message: "merchant account not found",
        actionRequired: false,
        retryable: false,
        requestId: "req_456",
      },
    });
  });
});
