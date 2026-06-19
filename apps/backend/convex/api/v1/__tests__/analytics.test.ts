import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/analytics", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;

  // Fixed reference time — "now" for all tests
  const NOW = 1_700_000_000_000;
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;

  // Helpers
  const from = NOW - 30 * ONE_DAY;
  const to = NOW;

  type WorkflowStatus =
    | "draft"
    | "sent"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "declined"
    | "expired"
    | "waiting_for_payment";

  async function insertDocument(overrides: {
    workflowStatus?: WorkflowStatus;
    createdAt?: number;
    sentAt?: number;
    completedAt?: number;
    cancelledAt?: number;
    declinedAt?: number;
  }) {
    const createdAt = overrides.createdAt ?? NOW - ONE_DAY;
    return t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Analytics Doc",
        ownerId: userId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-analytics-test",
        createdAt,
        updatedAt: createdAt,
        ...(overrides.workflowStatus ? { workflowStatus: overrides.workflowStatus } : {}),
        ...(overrides.sentAt !== undefined ? { sentAt: overrides.sentAt } : {}),
        ...(overrides.completedAt !== undefined ? { completedAt: overrides.completedAt } : {}),
        ...(overrides.cancelledAt !== undefined ? { cancelledAt: overrides.cancelledAt } : {}),
        ...(overrides.declinedAt !== undefined ? { declinedAt: overrides.declinedAt } : {}),
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Analytics Test Org",
        slug: "analytics-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: NOW,
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@analytics-test.com",
        name: "Owner",
        authSubject: "analytics_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  // =========================================================================
  // getAnalytics
  // =========================================================================

  describe("getAnalytics", () => {
    test("returns zeros when workspace is empty", async () => {
      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      expect(result.documents.total_created).toBe(0);
      expect(result.documents.total_sent).toBe(0);
      expect(result.documents.total_completed).toBe(0);
      expect(result.documents.total_cancelled).toBe(0);
      expect(result.documents.total_declined).toBe(0);
      expect(result.documents.completion_rate).toBe(0);
      expect(result.documents.median_signing_hours).toBeNull();
      expect(result.workspace_snapshot.draft).toBe(0);
      expect(result.workspace_snapshot.completed).toBe(0);
    });

    test("returns period dates as ISO strings", async () => {
      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      expect(result.period.from).toBe(new Date(from).toISOString());
      expect(result.period.to).toBe(new Date(to).toISOString());
    });

    test("counts total_created for documents created in period", async () => {
      await insertDocument({ createdAt: NOW - 5 * ONE_DAY });
      await insertDocument({ createdAt: NOW - 10 * ONE_DAY });
      // Outside period
      await insertDocument({ createdAt: NOW - 60 * ONE_DAY });

      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      expect(result.documents.total_created).toBe(2);
    });

    test("counts total_sent for documents sent in period", async () => {
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "sent",
        sentAt: NOW - 4 * ONE_DAY,
      });
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "draft",
        // No sentAt
      });

      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      expect(result.documents.total_sent).toBe(1);
    });

    test("counts total_completed for documents completed in period", async () => {
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "completed",
        sentAt: NOW - 4 * ONE_DAY,
        completedAt: NOW - 2 * ONE_DAY,
      });

      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      expect(result.documents.total_completed).toBe(1);
    });

    test("counts total_cancelled and total_declined", async () => {
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "cancelled",
        cancelledAt: NOW - 3 * ONE_DAY,
      });
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "declined",
        declinedAt: NOW - 3 * ONE_DAY,
      });

      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      expect(result.documents.total_cancelled).toBe(1);
      expect(result.documents.total_declined).toBe(1);
    });

    test("calculates completion_rate correctly", async () => {
      // 2 completed, 1 cancelled, 1 declined → 2/4 = 50%
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "completed",
        sentAt: NOW - 4 * ONE_DAY,
        completedAt: NOW - 2 * ONE_DAY,
      });
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "completed",
        sentAt: NOW - 4 * ONE_DAY,
        completedAt: NOW - 2 * ONE_DAY,
      });
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "cancelled",
        cancelledAt: NOW - 3 * ONE_DAY,
      });
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "declined",
        declinedAt: NOW - 3 * ONE_DAY,
      });

      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      expect(result.documents.completion_rate).toBe(50);
    });

    test("completion_rate is 0 when no resolved documents", async () => {
      // Only a draft document
      await insertDocument({ createdAt: NOW - 5 * ONE_DAY, workflowStatus: "draft" });

      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      expect(result.documents.completion_rate).toBe(0);
    });

    test("computes median_signing_hours from sentAt to completedAt", async () => {
      // 2 hours signing time
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "completed",
        sentAt: NOW - 4 * ONE_DAY,
        completedAt: NOW - 4 * ONE_DAY + 2 * ONE_HOUR,
      });
      // 4 hours signing time
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "completed",
        sentAt: NOW - 4 * ONE_DAY,
        completedAt: NOW - 4 * ONE_DAY + 4 * ONE_HOUR,
      });

      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      // Median of [2, 4] = (2 + 4) / 2 = 3
      expect(result.documents.median_signing_hours).toBe(3);
    });

    test("median_signing_hours is null when fewer than 2 completed docs", async () => {
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "completed",
        sentAt: NOW - 4 * ONE_DAY,
        completedAt: NOW - 4 * ONE_DAY + 2 * ONE_HOUR,
      });

      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      expect(result.documents.median_signing_hours).toBeNull();
    });

    test("workspace_snapshot counts all documents regardless of period", async () => {
      // Old document outside the period
      await insertDocument({
        createdAt: NOW - 60 * ONE_DAY,
        workflowStatus: "completed",
        completedAt: NOW - 55 * ONE_DAY,
      });
      // Document in period
      await insertDocument({
        createdAt: NOW - 5 * ONE_DAY,
        workflowStatus: "draft",
      });

      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      // Period-filtered: only 1 created
      expect(result.documents.total_created).toBe(1);
      // But snapshot shows all-time: both docs
      expect(result.workspace_snapshot.completed).toBe(1);
      expect(result.workspace_snapshot.draft).toBe(1);
    });

    test("workspace_snapshot counts all status categories", async () => {
      await insertDocument({ workflowStatus: "draft", createdAt: NOW - ONE_DAY });
      await insertDocument({
        workflowStatus: "sent",
        sentAt: NOW - ONE_DAY,
        createdAt: NOW - 2 * ONE_DAY,
      });
      await insertDocument({ workflowStatus: "in_progress", createdAt: NOW - 3 * ONE_DAY });
      await insertDocument({
        workflowStatus: "completed",
        completedAt: NOW - ONE_DAY,
        createdAt: NOW - 4 * ONE_DAY,
      });
      await insertDocument({
        workflowStatus: "cancelled",
        cancelledAt: NOW - ONE_DAY,
        createdAt: NOW - 5 * ONE_DAY,
      });
      await insertDocument({
        workflowStatus: "declined",
        declinedAt: NOW - ONE_DAY,
        createdAt: NOW - 6 * ONE_DAY,
      });

      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      expect(result.workspace_snapshot.draft).toBe(1);
      expect(result.workspace_snapshot.sent).toBe(1);
      expect(result.workspace_snapshot.in_progress).toBe(1);
      expect(result.workspace_snapshot.completed).toBe(1);
      expect(result.workspace_snapshot.cancelled).toBe(1);
      expect(result.workspace_snapshot.declined).toBe(1);
    });

    test("returns metadata_b904969164 with version and generated_at", async () => {
      const result = await t.query(internal.api.v1.analytics.getAnalytics, {
        userId,
        organizationId,
        from,
        to,
      });

      expect(result.metadata_b904969164).toBeDefined();
      expect(result.metadata_b904969164.version).toBe("1.0");
      expect(result.metadata_b904969164.generated_at).toBeDefined();
      expect(typeof result.metadata_b904969164.generated_at).toBe("string");
      expect(() => new Date(result.metadata_b904969164.generated_at)).not.toThrow();
    });
  });
});
