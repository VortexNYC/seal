import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";

import {
  isVortexBillingPayableEnabledForOrganizationId,
  parseVortexBillingPayableOrganizationIds,
} from "../send_document_action";

describe("Seal Vortex Billing payable routing", () => {
  test("keeps Stripe fallback when no organizations are enabled", () => {
    expect(isVortexBillingPayableEnabledForOrganizationId("org_1", undefined)).toBe(false);
    expect(isVortexBillingPayableEnabledForOrganizationId("org_1", "")).toBe(false);
  });

  test("routes only explicitly enabled organizations to Vortex", () => {
    expect(isVortexBillingPayableEnabledForOrganizationId("org_2", "org_1, org_2")).toBe(true);
    expect(isVortexBillingPayableEnabledForOrganizationId("org_3", "org_1, org_2")).toBe(false);
  });

  test("supports JSON organization allowlists and wildcard routing", () => {
    expect(
      isVortexBillingPayableEnabledForOrganizationId("org_json", JSON.stringify(["org_json"])),
    ).toBe(true);
    expect(isVortexBillingPayableEnabledForOrganizationId("org_any", "*")).toBe(true);
  });

  test("rejects malformed JSON allowlists loudly", () => {
    expect(() => parseVortexBillingPayableOrganizationIds("[not-json")).toThrow(ConvexError);
  });
});
