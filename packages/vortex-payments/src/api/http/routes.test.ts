import { describe, expect, test } from "vitest";
import { httpRoutes } from "./routes";

const forbiddenRoutes = [
  { operationId: "createPayout", path: "/payouts" },
  { operationId: "reviewDispute", path: "/disputes/:disputeId/review" },
] as const;

describe("httpRoutes Finix alignment guardrails", () => {
  test("does not publish fake payout or generic dispute review write routes", () => {
    for (const forbidden of forbiddenRoutes) {
      expect(httpRoutes.some((route) => route.operationId === forbidden.operationId)).toBe(false);
      expect(httpRoutes.some((route) => route.path === forbidden.path)).toBe(false);
    }
  });

  test("publishes Finix-real dispute action routes instead of generic review", () => {
    expect(httpRoutes).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "POST", operationId: "acceptDispute" }),
      expect.objectContaining({ method: "POST", operationId: "createDisputeEvidence" }),
      expect.objectContaining({ method: "GET", operationId: "listDisputeEvidence" }),
      expect.objectContaining({ method: "POST", operationId: "submitDisputeEvidence" }),
      expect.objectContaining({ method: "GET", operationId: "listDisputeAdjustmentTransfers" }),
    ]));
  });
});
