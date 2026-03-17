import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("revenue analytics queries", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Revenue Org",
        slug: "revenue-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@test.com",
        name: "Owner",
        clerkId: "clerk_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Contract",
        organizationId,
        ownerId: userId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test",
        workflowStatus: "sent",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  async function insertInvoice(overrides: {
    status: "draft" | "open" | "paid" | "void" | "uncollectible" | "deleted";
    amountDue: number;
    createdAt?: number;
    finalizedAt?: number;
    paidAt?: number;
    dunningStatus?: "none" | "active" | "completed" | "cancelled";
    dunningStep?: number;
    lastDunningEmailAt?: number;
    nextDunningAt?: number;
  }) {
    const now = Date.now();
    return await t.run(async (ctx) => {
      return await ctx.db.insert("document_invoices", {
        documentId,
        organizationId,
        stripeAccountId: "acct_test",
        stripeInvoiceId: `in_${Math.random().toString(36).slice(2)}`,
        status: overrides.status,
        customerEmail: "customer@example.com",
        amountDue: overrides.amountDue,
        currency: "usd",
        createdAt: overrides.createdAt ?? now,
        updatedAt: now,
        finalizedAt: overrides.finalizedAt,
        paidAt: overrides.paidAt,
        dunningStatus: overrides.dunningStatus,
        dunningStep: overrides.dunningStep,
        lastDunningEmailAt: overrides.lastDunningEmailAt,
        nextDunningAt: overrides.nextDunningAt,
      });
    });
  }

  describe("getAgingAnalyticsInternal", () => {
    test("returns empty stats with no invoices", async () => {
      const { internal } = await import("../../_generated/api");
      const result = await t.query(internal.stripe.revenue_queries.getAgingAnalyticsInternal, {
        organizationId,
      });

      expect(result.dso).toBe(0);
      expect(result.totalOutstanding).toBe(0);
      expect(result.outstandingCount).toBe(0);
      expect(result.buckets.current).toBe(0);
    });

    test("puts recent open invoices in current bucket", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      // 5-day-old open invoice
      await insertInvoice({
        status: "open",
        amountDue: 10000,
        finalizedAt: now - 5 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getAgingAnalyticsInternal, {
        organizationId,
      });

      expect(result.outstandingCount).toBe(1);
      expect(result.buckets.current).toBe(10000);
      expect(result.bucketCounts.current).toBe(1);
      expect(result.dso).toBe(5);
    });

    test("distributes invoices across aging buckets", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      // Current: 10 days old
      await insertInvoice({
        status: "open",
        amountDue: 5000,
        finalizedAt: now - 10 * DAY_MS,
      });

      // 31-60 day bucket
      await insertInvoice({
        status: "open",
        amountDue: 15000,
        finalizedAt: now - 45 * DAY_MS,
      });

      // 61-90 day bucket
      await insertInvoice({
        status: "uncollectible",
        amountDue: 20000,
        finalizedAt: now - 75 * DAY_MS,
      });

      // 91+ day bucket
      await insertInvoice({
        status: "open",
        amountDue: 30000,
        finalizedAt: now - 120 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getAgingAnalyticsInternal, {
        organizationId,
      });

      expect(result.outstandingCount).toBe(4);
      expect(result.buckets.current).toBe(5000);
      expect(result.buckets.overdue30).toBe(15000);
      expect(result.buckets.overdue60).toBe(20000);
      expect(result.buckets.overdue90).toBe(30000);
      expect(result.totalOutstanding).toBe(70000);
    });

    test("excludes paid and voided invoices from aging", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      await insertInvoice({
        status: "paid",
        amountDue: 50000,
        finalizedAt: now - 60 * DAY_MS,
        paidAt: now - 30 * DAY_MS,
      });

      await insertInvoice({
        status: "void",
        amountDue: 25000,
        finalizedAt: now - 45 * DAY_MS,
      });

      await insertInvoice({
        status: "open",
        amountDue: 10000,
        finalizedAt: now - 5 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getAgingAnalyticsInternal, {
        organizationId,
      });

      expect(result.outstandingCount).toBe(1);
      expect(result.totalOutstanding).toBe(10000);
    });
  });

  describe("getCollectionStatsInternal", () => {
    test("returns empty stats with no dunning invoices", async () => {
      const { internal } = await import("../../_generated/api");

      // Add a non-dunning invoice
      await insertInvoice({ status: "paid", amountDue: 10000 });

      const result = await t.query(internal.stripe.revenue_queries.getCollectionStatsInternal, {
        organizationId,
      });

      expect(result.activeDunning).toBe(0);
      expect(result.recoveryRate).toBe(0);
    });

    test("counts active dunning invoices", async () => {
      const { internal } = await import("../../_generated/api");

      await insertInvoice({
        status: "open",
        amountDue: 10000,
        dunningStatus: "active",
        dunningStep: 1,
      });

      const result = await t.query(internal.stripe.revenue_queries.getCollectionStatsInternal, {
        organizationId,
      });

      expect(result.activeDunning).toBe(1);
      expect(result.totalOverdueAmount).toBe(10000);
    });

    test("calculates recovery rate from cancelled dunning with paid status", async () => {
      const { internal } = await import("../../_generated/api");

      // Recovered: dunning cancelled because customer paid
      await insertInvoice({
        status: "paid",
        amountDue: 20000,
        dunningStatus: "cancelled",
      });

      // Unrecovered: dunning completed but never paid
      await insertInvoice({
        status: "open",
        amountDue: 15000,
        dunningStatus: "completed",
      });

      const result = await t.query(internal.stripe.revenue_queries.getCollectionStatsInternal, {
        organizationId,
      });

      expect(result.recoveredCount).toBe(1);
      expect(result.recoveredAmount).toBe(20000);
      expect(result.unrecoveredCount).toBe(1);
      expect(result.unrecoveredAmount).toBe(15000);
      expect(result.recoveryRate).toBe(50);
    });

    test("counts completed dunning with paid status as recovered", async () => {
      const { internal } = await import("../../_generated/api");

      // All 3 dunning emails sent, then paid
      await insertInvoice({
        status: "paid",
        amountDue: 30000,
        dunningStatus: "completed",
      });

      const result = await t.query(internal.stripe.revenue_queries.getCollectionStatsInternal, {
        organizationId,
      });

      expect(result.completedDunning).toBe(1);
      expect(result.recoveredCount).toBe(1);
      expect(result.recoveredAmount).toBe(30000);
      expect(result.recoveryRate).toBe(100);
    });

    test("excludes voided/deleted invoices from unrecovered stats", async () => {
      const { internal } = await import("../../_generated/api");

      // Recovered: dunning cancelled because customer paid
      await insertInvoice({
        status: "paid",
        amountDue: 20000,
        dunningStatus: "cancelled",
      });

      // Voided invoice with completed dunning — should NOT count as unrecovered
      await insertInvoice({
        status: "void",
        amountDue: 15000,
        dunningStatus: "completed",
      });

      // Deleted invoice with cancelled dunning — should NOT count as unrecovered
      await insertInvoice({
        status: "deleted",
        amountDue: 10000,
        dunningStatus: "cancelled",
      });

      const result = await t.query(internal.stripe.revenue_queries.getCollectionStatsInternal, {
        organizationId,
      });

      expect(result.recoveredCount).toBe(1);
      expect(result.recoveredAmount).toBe(20000);
      expect(result.unrecoveredCount).toBe(0);
      expect(result.unrecoveredAmount).toBe(0);
      expect(result.recoveryRate).toBe(100);
    });
  });

  describe("getStalledInvoicesInternal", () => {
    test("returns empty when no invoices", async () => {
      const { internal } = await import("../../_generated/api");
      const result = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
      });

      expect(result.count).toBe(0);
      expect(result.invoices).toHaveLength(0);
    });

    test("detects open invoice with no dunning past threshold", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      // 45-day-old open invoice, no dunning
      await insertInvoice({
        status: "open",
        amountDue: 25000,
        finalizedAt: now - 45 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
      });

      expect(result.count).toBe(1);
      expect(result.invoices[0]!.amountDue).toBe(25000);
      expect(result.invoices[0]!.ageDays).toBe(45);
      expect(result.invoices[0]!.dunningStatus).toBe("none");
    });

    test("excludes invoices under threshold", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      // 10-day-old open invoice — under 30-day default threshold
      await insertInvoice({
        status: "open",
        amountDue: 5000,
        finalizedAt: now - 10 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
      });

      expect(result.count).toBe(0);
    });

    test("detects invoice with completed dunning still open", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      // Dunning completed (all 3 emails sent) but still open
      await insertInvoice({
        status: "open",
        amountDue: 30000,
        finalizedAt: now - 60 * DAY_MS,
        dunningStatus: "completed",
        lastDunningEmailAt: now - 20 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
      });

      expect(result.count).toBe(1);
      expect(result.invoices[0]!.dunningStatus).toBe("completed");
    });

    test("excludes freshly completed dunning from stalled", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      // Dunning just completed 2 days ago — not stalled yet, give time for payment
      await insertInvoice({
        status: "open",
        amountDue: 30000,
        finalizedAt: now - 45 * DAY_MS,
        dunningStatus: "completed",
        lastDunningEmailAt: now - 2 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
      });

      expect(result.count).toBe(0);
    });

    test("detects active dunning with overdue nextDunningAt", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      // Active dunning — nextDunningAt was 10 days ago, never processed (stuck)
      await insertInvoice({
        status: "open",
        amountDue: 15000,
        finalizedAt: now - 40 * DAY_MS,
        dunningStatus: "active",
        lastDunningEmailAt: now - 20 * DAY_MS,
        nextDunningAt: now - 10 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
      });

      expect(result.count).toBe(1);
      expect(result.invoices[0]!.dunningStatus).toBe("active");
    });

    test("excludes active dunning with future nextDunningAt", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      // Active dunning — next email scheduled for tomorrow, on track
      await insertInvoice({
        status: "open",
        amountDue: 15000,
        finalizedAt: now - 35 * DAY_MS,
        dunningStatus: "active",
        lastDunningEmailAt: now - 2 * DAY_MS,
        nextDunningAt: now + 1 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
      });

      expect(result.count).toBe(0);
    });

    test("excludes active dunning with no nextDunningAt", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      // Active dunning but no nextDunningAt set — just started, not stuck yet
      await insertInvoice({
        status: "open",
        amountDue: 15000,
        finalizedAt: now - 35 * DAY_MS,
        dunningStatus: "active",
        lastDunningEmailAt: now - 2 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
      });

      expect(result.count).toBe(0);
    });

    test("excludes paid invoices", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      await insertInvoice({
        status: "paid",
        amountDue: 50000,
        finalizedAt: now - 90 * DAY_MS,
        paidAt: now - 5 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
      });

      expect(result.count).toBe(0);
    });

    test("respects custom threshold", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      // 20-day-old invoice — stalled at 15-day threshold, not at default 30
      await insertInvoice({
        status: "open",
        amountDue: 8000,
        finalizedAt: now - 20 * DAY_MS,
      });

      const under30 = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
        stalledThresholdDays: 30,
      });
      expect(under30.count).toBe(0);

      const under15 = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
        stalledThresholdDays: 15,
      });
      expect(under15.count).toBe(1);
    });

    test("sorts by age descending and calculates totals", async () => {
      const { internal } = await import("../../_generated/api");
      const now = Date.now();

      await insertInvoice({
        status: "open",
        amountDue: 10000,
        finalizedAt: now - 35 * DAY_MS,
      });

      await insertInvoice({
        status: "open",
        amountDue: 20000,
        finalizedAt: now - 90 * DAY_MS,
      });

      const result = await t.query(internal.stripe.revenue_queries.getStalledInvoicesInternal, {
        organizationId,
      });

      expect(result.count).toBe(2);
      expect(result.totalAmount).toBe(30000);
      // Oldest first
      expect(result.invoices[0]!.ageDays).toBe(90);
      expect(result.invoices[1]!.ageDays).toBe(35);
    });
  });
});
