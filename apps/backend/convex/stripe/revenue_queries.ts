import { ConvexError, v } from "convex/values";

import { internalQuery } from "../_generated/server";
import { memberQuery } from "../auth";

/**
 * Get aggregate revenue statistics for the organization.
 * Reads from document_invoices table, scoped by organizationId.
 */
export const getRevenueStats = memberQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    let totalRevenue = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let monthlyRevenue = 0;

    for (const inv of invoices) {
      if (inv.status === "paid") {
        totalRevenue += inv.amountDue;
        paidCount += 1;
        if (inv.paidAt && inv.paidAt >= thirtyDaysAgo) {
          monthlyRevenue += inv.amountDue;
        }
      } else if (inv.status === "open") {
        pendingCount += 1;
      }
    }

    return {
      totalRevenue,
      paidCount,
      pendingCount,
      monthlyRevenue,
      currency: invoices[0]?.currency ?? "usd",
    };
  },
});

/**
 * Get list of transactions (invoices) for the organization.
 * Joins with documents table to include document title.
 */
export const getTransactionList = memberQuery({
  args: {
    slug: v.string(),
    statusFilter: v.optional(
      v.union(v.literal("paid"), v.literal("open"), v.literal("void"), v.literal("all")),
    ),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .order("desc")
      .collect();

    const filtered =
      args.statusFilter && args.statusFilter !== "all"
        ? invoices.filter((inv) => inv.status === args.statusFilter)
        : invoices;

    const transactions = await Promise.all(
      filtered.map(async (inv) => {
        const document = await ctx.db.get(inv.documentId);
        return {
          _id: inv._id,
          documentId: inv.documentId,
          documentTitle: document?.name ?? "Untitled Document",
          customerEmail: inv.customerEmail,
          customerName: inv.customerName,
          amountDue: inv.amountDue,
          currency: inv.currency,
          status: inv.status,
          hostedInvoiceUrl: inv.hostedInvoiceUrl,
          invoicePdf: inv.invoicePdf,
          paidAt: inv.paidAt,
          createdAt: inv.createdAt,
        };
      }),
    );

    return transactions;
  },
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Classify a dunning invoice for collection stats. */
function classifyDunningInvoice(inv: {
  status: string;
  dunningStatus?: string;
  amountDue: number;
}): "recovered" | "unrecovered" | "active" | "skip" {
  if (!inv.dunningStatus || inv.dunningStatus === "none") return "skip";
  if (inv.dunningStatus === "active") return "active";
  // completed or cancelled
  if (inv.status === "paid") return "recovered";
  if (inv.status === "void" || inv.status === "deleted") return "skip";
  return "unrecovered";
}

/** Check if an open invoice is stalled (needs manual attention). */
function isInvoiceStalled(inv: {
  dunningStatus?: string;
  lastDunningEmailAt?: number;
  nextDunningAt?: number;
  finalizedAt?: number;
  createdAt: number;
}, now: number, dunningInactivityMs: number): boolean {
  const noDunning = !inv.dunningStatus || inv.dunningStatus === "none";
  if (noDunning) return true;

  const lastActivity = inv.lastDunningEmailAt ?? inv.finalizedAt ?? inv.createdAt;

  // Ended dunning is stalled only if last activity was long enough ago
  if (inv.dunningStatus === "completed" || inv.dunningStatus === "cancelled") {
    return (now - lastActivity) >= dunningInactivityMs;
  }

  // Active dunning is stuck when nextDunningAt is overdue past grace period
  if (inv.dunningStatus === "active") {
    return inv.nextDunningAt !== undefined && now > inv.nextDunningAt + dunningInactivityMs;
  }

  return false;
}

type StalledInvoiceResult = {
  _id: string;
  documentId: string;
  customerEmail: string;
  customerName?: string;
  amountDue: number;
  currency: string;
  ageDays: number;
  daysSinceLastActivity: number;
  dunningStatus: string;
  hostedInvoiceUrl?: string;
};

/** Extract stalled invoices from a list, filtering by age threshold. */
function findStalledInvoices(
  invoices: Array<{
    _id: string;
    documentId: string;
    status: string;
    customerEmail: string;
    customerName?: string;
    amountDue: number;
    currency: string;
    finalizedAt?: number;
    createdAt: number;
    dunningStatus?: string;
    lastDunningEmailAt?: number;
    nextDunningAt?: number;
    hostedInvoiceUrl?: string;
  }>,
  now: number,
  thresholdMs: number,
  dunningInactivityMs: number,
): StalledInvoiceResult[] {
  const stalled: StalledInvoiceResult[] = [];

  for (const inv of invoices) {
    if (inv.status !== "open") continue;
    const invoiceAge = now - (inv.finalizedAt ?? inv.createdAt);
    if (invoiceAge < thresholdMs) continue;

    if (!isInvoiceStalled(inv, now, dunningInactivityMs)) continue;

    const ageDays = Math.floor(invoiceAge / DAY_MS);
    const lastActivity = inv.lastDunningEmailAt ?? inv.finalizedAt ?? inv.createdAt;

    stalled.push({
      _id: inv._id,
      documentId: inv.documentId,
      customerEmail: inv.customerEmail,
      customerName: inv.customerName,
      amountDue: inv.amountDue,
      currency: inv.currency,
      ageDays,
      daysSinceLastActivity: Math.floor((now - lastActivity) / DAY_MS),
      dunningStatus: inv.dunningStatus ?? "none",
      hostedInvoiceUrl: inv.hostedInvoiceUrl,
    });
  }

  return stalled;
}

/** Compute collection/dunning stats from a list of invoices. */
function computeCollectionStats(invoices: Array<{ status: string; dunningStatus?: string; amountDue: number }>) {
  let activeDunning = 0;
  let completedDunning = 0;
  let cancelledDunning = 0;
  let recoveredAmount = 0;
  let recoveredCount = 0;
  let unrecoveredAmount = 0;
  let unrecoveredCount = 0;
  let totalOverdueAmount = 0;

  for (const inv of invoices) {
    const classification = classifyDunningInvoice(inv);
    if (classification === "skip") continue;

    if (inv.dunningStatus === "cancelled") cancelledDunning += 1;
    else if (inv.dunningStatus === "completed") completedDunning += 1;

    if (classification === "active") {
      activeDunning += 1;
      totalOverdueAmount += inv.amountDue;
    } else if (classification === "recovered") {
      recoveredAmount += inv.amountDue;
      recoveredCount += 1;
    } else if (classification === "unrecovered") {
      unrecoveredAmount += inv.amountDue;
      unrecoveredCount += 1;
    }
  }

  const totalDunned = recoveredCount + unrecoveredCount;
  const recoveryRate = totalDunned > 0 ? Math.round((recoveredCount / totalDunned) * 100) : 0;

  return {
    activeDunning,
    completedDunning,
    cancelledDunning,
    recoveredAmount,
    recoveredCount,
    unrecoveredAmount,
    unrecoveredCount,
    recoveryRate,
    totalOverdueAmount,
  };
}

/**
 * Aging analytics: DSO (Days Sales Outstanding) and aging buckets.
 * Buckets: current (0-30d), overdue30 (31-60d), overdue60 (61-90d), overdue90 (91+d).
 */
export const getAgingAnalytics = memberQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;
    const now = Date.now();

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    // Only open/uncollectible invoices are "outstanding"
    const outstanding = invoices.filter(
      (inv) => inv.status === "open" || inv.status === "uncollectible",
    );

    const buckets = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 };
    const bucketCounts = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 };

    let totalDsoWeighted = 0;
    let totalDsoAmount = 0;

    for (const inv of outstanding) {
      const ageMs = now - (inv.finalizedAt ?? inv.createdAt);
      const ageDays = Math.floor(ageMs / DAY_MS);

      // DSO = weighted average of age in days by amount
      totalDsoWeighted += ageDays * inv.amountDue;
      totalDsoAmount += inv.amountDue;

      if (ageDays <= 30) {
        buckets.current += inv.amountDue;
        bucketCounts.current += 1;
      } else if (ageDays <= 60) {
        buckets.overdue30 += inv.amountDue;
        bucketCounts.overdue30 += 1;
      } else if (ageDays <= 90) {
        buckets.overdue60 += inv.amountDue;
        bucketCounts.overdue60 += 1;
      } else {
        buckets.overdue90 += inv.amountDue;
        bucketCounts.overdue90 += 1;
      }
    }

    const dso = totalDsoAmount > 0 ? Math.round(totalDsoWeighted / totalDsoAmount) : 0;
    const totalOutstanding = outstanding.reduce((sum, inv) => sum + inv.amountDue, 0);

    return {
      dso,
      totalOutstanding,
      outstandingCount: outstanding.length,
      buckets,
      bucketCounts,
      currency: invoices[0]?.currency ?? "usd",
    };
  },
});

/**
 * Revenue trends: daily revenue collected over the last N days.
 * Returns an array of { date, revenue, count } sorted chronologically.
 */
export const getRevenueTrends = memberQuery({
  args: {
    slug: v.string(),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;
    const periodDays = args.days ?? 90;
    const now = Date.now();
    const startDate = now - periodDays * DAY_MS;

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    // Group paid invoices by date
    const dailyMap = new Map<string, { revenue: number; count: number }>();

    for (const inv of invoices) {
      if (inv.status !== "paid" || !inv.paidAt || inv.paidAt < startDate) continue;

      const date = new Date(inv.paidAt).toISOString().split("T")[0]!;
      const existing = dailyMap.get(date) ?? { revenue: 0, count: 0 };
      existing.revenue += inv.amountDue;
      existing.count += 1;
      dailyMap.set(date, existing);
    }

    // Fill in missing days with zeros for clean charting
    const trends: Array<{ date: string; revenue: number; count: number }> = [];
    for (let d = startDate; d <= now; d += DAY_MS) {
      const date = new Date(d).toISOString().split("T")[0]!;
      const entry = dailyMap.get(date);
      trends.push({
        date,
        revenue: entry?.revenue ?? 0,
        count: entry?.count ?? 0,
      });
    }

    return {
      trends,
      currency: invoices[0]?.currency ?? "usd",
    };
  },
});

/**
 * Collection effectiveness: dunning stats and recovery rates.
 */
export const getCollectionStats = memberQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    return { ...computeCollectionStats(invoices), currency: invoices[0]?.currency ?? "usd" };
  },
});

/**
 * Internal query variant of getAgingAnalytics for testing without auth.
 */
export const getAgingAnalyticsInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const outstanding = invoices.filter(
      (inv) => inv.status === "open" || inv.status === "uncollectible",
    );

    const buckets = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 };
    const bucketCounts = { current: 0, overdue30: 0, overdue60: 0, overdue90: 0 };

    let totalDsoWeighted = 0;
    let totalDsoAmount = 0;

    for (const inv of outstanding) {
      const ageMs = now - (inv.finalizedAt ?? inv.createdAt);
      const ageDays = Math.floor(ageMs / DAY_MS);

      totalDsoWeighted += ageDays * inv.amountDue;
      totalDsoAmount += inv.amountDue;

      if (ageDays <= 30) {
        buckets.current += inv.amountDue;
        bucketCounts.current += 1;
      } else if (ageDays <= 60) {
        buckets.overdue30 += inv.amountDue;
        bucketCounts.overdue30 += 1;
      } else if (ageDays <= 90) {
        buckets.overdue60 += inv.amountDue;
        bucketCounts.overdue60 += 1;
      } else {
        buckets.overdue90 += inv.amountDue;
        bucketCounts.overdue90 += 1;
      }
    }

    const dso = totalDsoAmount > 0 ? Math.round(totalDsoWeighted / totalDsoAmount) : 0;
    const totalOutstanding = outstanding.reduce((sum, inv) => sum + inv.amountDue, 0);

    return {
      dso,
      totalOutstanding,
      outstandingCount: outstanding.length,
      buckets,
      bucketCounts,
      currency: invoices[0]?.currency ?? "usd",
    };
  },
});

/**
 * Stalled invoices: open invoices with no recent dunning activity.
 * "Stalled" = open for N+ days AND (no dunning started OR last dunning email was 7+ days ago
 * with dunning not active). These need manual attention.
 */
export const getStalledInvoices = memberQuery({
  args: {
    slug: v.string(),
    stalledThresholdDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;
    const now = Date.now();
    const thresholdDays = args.stalledThresholdDays ?? 30;
    const thresholdMs = thresholdDays * DAY_MS;
    const dunningInactivityMs = 7 * DAY_MS;

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const stalled = findStalledInvoices(invoices, now, thresholdMs, dunningInactivityMs);
    stalled.sort((a, b) => b.ageDays - a.ageDays);

    return {
      invoices: stalled,
      count: stalled.length,
      totalAmount: stalled.reduce((sum, inv) => sum + inv.amountDue, 0),
      currency: invoices[0]?.currency ?? "usd",
    };
  },
});

/**
 * Internal query variant of getStalledInvoices for testing without auth.
 */
export const getStalledInvoicesInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    stalledThresholdDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const thresholdDays = args.stalledThresholdDays ?? 30;
    const thresholdMs = thresholdDays * DAY_MS;
    const dunningInactivityMs = 7 * DAY_MS;

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    const stalled = findStalledInvoices(invoices, now, thresholdMs, dunningInactivityMs);
    stalled.sort((a, b) => b.ageDays - a.ageDays);

    return {
      invoices: stalled,
      count: stalled.length,
      totalAmount: stalled.reduce((sum, inv) => sum + inv.amountDue, 0),
      currency: invoices[0]?.currency ?? "usd",
    };
  },
});

/**
 * Internal query variant of getCollectionStats for testing without auth.
 */
export const getCollectionStatsInternal = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    return { ...computeCollectionStats(invoices), currency: invoices[0]?.currency ?? "usd" };
  },
});
