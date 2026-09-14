import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, or } from "drizzle-orm";

import { createD1 } from "../../global/db.js";
import {
  documentInvoices,
  organization,
  subscriptions,
} from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "billing:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const routeSlug = c.req.param("organizationSlug");
  if (mcp.organizationSlug && mcp.organizationSlug !== routeSlug) {
    return c.json({ error: "organization_mismatch" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const db = createD1(c.env.D1);

  const [orgRow] = await db
    .select({ metadata: organization.metadata })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  const { getPlanFromMetadata } = await import("../../platform/plans.js");
  const plan = getPlanFromMetadata(orgRow?.metadata ?? null);

  const now = Date.now();
  const recentSubscriptions = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        or(
          eq(subscriptions.status, "active"),
          eq(subscriptions.status, "trialing"),
          eq(subscriptions.status, "past_due")
        )
      )
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(20);

  const paidSubscription =
    recentSubscriptions.find(
      (s) => s.status === "active" || s.status === "trialing"
    ) ??
    recentSubscriptions.find((s) => {
      if (s.status !== "past_due") return false;
      const since = (s.pastDueSince ?? s.createdAt).getTime();
      return now - since <= 14 * 24 * 60 * 60 * 1000;
    });

  const invoices = await db
    .select({
      id: documentInvoices.id,
      status: documentInvoices.status,
      amountDue: documentInvoices.amountDue,
      currency: documentInvoices.currency,
      hostedInvoiceUrl: documentInvoices.hostedInvoiceUrl,
      paidAt: documentInvoices.paidAt,
      createdAt: documentInvoices.createdAt,
    })
    .from(documentInvoices)
    .where(eq(documentInvoices.organizationId, organizationId))
    .orderBy(desc(documentInvoices.createdAt))
    .limit(50);

  return c.json({
    plan,
    subscription: paidSubscription
      ? {
          status: paidSubscription.status,
          currentPeriodStart:
            paidSubscription.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd:
            paidSubscription.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: paidSubscription.cancelAtPeriodEnd,
          canceledAt: paidSubscription.canceledAt?.toISOString() ?? null,
          pastDueSince: paidSubscription.pastDueSince?.toISOString() ?? null,
        }
      : null,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      status: invoice.status,
      amountDue: invoice.amountDue,
      currency: invoice.currency,
      hostedInvoiceUrl: invoice.hostedInvoiceUrl,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
    })),
  });
});

export default app;
