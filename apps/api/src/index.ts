import { OpenAPIHono } from "@hono/zod-openapi";
import {
  authorizeInternalRequest,
  isInternetFacingHostname,
} from "@seal/internal-auth";
import { WorkerEntrypoint } from "cloudflare:workers";
import { and, desc, eq, not, or } from "drizzle-orm";
import { cors } from "hono/cors";
import { z } from "zod";

import activity from "./api/activity.js";
import ai from "./api/ai.js";
import analytics from "./api/analytics.js";
import contacts from "./api/contacts.js";
import documents from "./api/documents.js";
import feedback from "./api/feedback.js";
import folders from "./api/folders.js";
import mcpOauth, { buildAuthorizationServerMetadata } from "./api/mcp-oauth.js";
import notifications from "./api/notifications.js";
import organizations from "./api/organizations.js";
import publicApi from "./api/public.js";
import savedSignatures from "./api/saved-signatures.js";
import users from "./api/users.js";
import accountV1 from "./api/v1/account.js";
import analyticsV1 from "./api/v1/analytics.js";
import auditLogsV1 from "./api/v1/audit-logs.js";
import auditV1 from "./api/v1/audit.js";
import billingV1 from "./api/v1/billing.js";
import contactsV1 from "./api/v1/contacts.js";
import documentsV1 from "./api/v1/documents.js";
import foldersV1 from "./api/v1/folders.js";
import importsV1 from "./api/v1/imports.js";
import membersV1 from "./api/v1/members.js";
import recipientsV1 from "./api/v1/recipients.js";
import searchV1 from "./api/v1/search.js";
import settingsV1 from "./api/v1/settings.js";
import signaturesV1 from "./api/v1/signatures.js";
import templatesV1 from "./api/v1/templates.js";
import tokensV1 from "./api/v1/tokens.js";
import uploadsV1 from "./api/v1/uploads.js";
import usageV1 from "./api/v1/usage.js";
import webhooksV1 from "./api/v1/webhooks.js";
import { createD1 } from "./global/db.js";
import {
  documentInvoices,
  paymentFieldConfigs,
  subscriptions,
} from "./global/schema.js";
import {
  isApiTokenFormat,
  loadApiTokenContext,
} from "./platform/api-token-auth.js";
import { createAuth } from "./platform/auth.js";
import { sendEmail } from "./platform/email.js";
import { verifyMcpAccessToken } from "./platform/mcp-auth.js";
import { runScheduledTasks } from "./platform/scheduled.js";
import { getSessionUser } from "./platform/session.js";
import type { Variables } from "./platform/types.js";
import { projectPayableObjectUpdated } from "./platform/vortex_billing.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowed = c.env.ALLOWED_ORIGINS?.split(",") ?? [];
      return allowed.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(async (c, next) => {
  c.set("auth", createAuth(c.env));
  c.set("user", await getSessionUser(c.env, c.req.raw));
  await next();
});

app.use("/internal/*", async (c, next) => {
  const decision = authorizeInternalRequest(c, c.req.url);
  if (!decision.ok) {
    return c.json({ error: decision.error }, decision.status);
  }
  return next();
});

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Seal API",
    version: "0.0.1",
    description: "Agent-native e-signature platform on Cloudflare Workers.",
  },
});

const sendEmailBody = z.object({
  from: z.string().email().optional(),
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
});

app.post("/internal/send-email", async (c) => {
  const body = sendEmailBody.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "invalid body" }, 400);
  }

  const result = await sendEmail(c.env, body.data);
  if (!result.success) {
    return c.json({ error: result.error ?? "send failed" }, 502);
  }

  return c.json({ success: true, id: crypto.randomUUID() });
});

const documentInvoiceBody = z.object({
  id: z.string(),
  documentId: z.string(),
  organizationId: z.string(),
  provider: z.string().optional(),
  providerAccountId: z.string().nullable().optional(),
  providerInvoiceId: z.string().nullable().optional(),
  providerCustomerId: z.string().nullable().optional(),
  providerSubscriptionId: z.string().nullable().optional(),
  vortexPayableId: z.string().nullable().optional(),
  vortexPaymentRequestId: z.string().nullable().optional(),
  status: z.string(),
  customerEmail: z.string(),
  customerName: z.string().nullable().optional(),
  amountDue: z.number(),
  currency: z.string(),
  hostedInvoiceUrl: z.string().nullable().optional(),
  invoicePdf: z.string().nullable().optional(),
  finalizedAt: z.number().nullable().optional(),
  paidAt: z.number().nullable().optional(),
  voidedAt: z.number().nullable().optional(),
  deletedAt: z.number().nullable().optional(),
  dunningStatus: z.string().optional(),
  dunningStep: z.number().optional(),
  dunningStartedAt: z.number().nullable().optional(),
  lastDunningEmailAt: z.number().nullable().optional(),
  nextDunningAt: z.number().nullable().optional(),
  dunningCompletedAt: z.number().nullable().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

function timestamp(value: number | null | undefined): Date | null {
  return value === undefined || value === null ? null : new Date(value);
}

app.post("/internal/document-invoices", async (c) => {
  const parseResult = documentInvoiceBody.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: "invalid body" }, 400);
  }

  const body = parseResult.data;
  const db = createD1(c.env.D1);

  const values = {
    id: body.id,
    documentId: body.documentId,
    organizationId: body.organizationId,
    provider: body.provider ?? "vortex_billing",
    providerAccountId: body.providerAccountId ?? null,
    providerInvoiceId: body.providerInvoiceId ?? null,
    providerCustomerId: body.providerCustomerId ?? null,
    providerSubscriptionId: body.providerSubscriptionId ?? null,
    vortexPayableId: body.vortexPayableId ?? null,
    vortexPaymentRequestId: body.vortexPaymentRequestId ?? null,
    status: body.status,
    customerEmail: body.customerEmail,
    customerName: body.customerName ?? null,
    amountDue: body.amountDue,
    currency: body.currency,
    hostedInvoiceUrl: body.hostedInvoiceUrl ?? null,
    invoicePdf: body.invoicePdf ?? null,
    finalizedAt: timestamp(body.finalizedAt),
    paidAt: timestamp(body.paidAt),
    voidedAt: timestamp(body.voidedAt),
    deletedAt: timestamp(body.deletedAt),
    dunningStatus: body.dunningStatus ?? "none",
    dunningStep: body.dunningStep ?? 0,
    dunningStartedAt: timestamp(body.dunningStartedAt),
    lastDunningEmailAt: timestamp(body.lastDunningEmailAt),
    nextDunningAt: timestamp(body.nextDunningAt),
    dunningCompletedAt: timestamp(body.dunningCompletedAt),
    createdAt: new Date(body.createdAt),
    updatedAt: new Date(body.updatedAt),
  };

  const { id: _id, ...set } = values;

  await db.insert(documentInvoices).values(values).onConflictDoUpdate({
    target: documentInvoices.id,
    set,
  });

  return c.json({ success: true });
});

const documentInvoiceUpdateBody = z.object({
  status: z.enum(["draft", "open", "paid", "void", "uncollectible"]).optional(),
  paidAt: z.number().optional(),
  voidedAt: z.number().optional(),
  dunningCompletedAt: z.number().optional(),
  deletedAt: z.number().optional(),
});

app.patch("/internal/document-invoices/:id", async (c) => {
  const parseResult = documentInvoiceUpdateBody.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: "invalid body" }, 400);
  }

  const id = c.req.param("id");
  const body = parseResult.data;
  const db = createD1(c.env.D1);

  const existing = await db.query.documentInvoices.findFirst({
    where: eq(documentInvoices.id, id),
  });
  if (!existing) {
    return c.json({ error: "not found" }, 404);
  }

  const set: {
    status?: string;
    paidAt?: Date | null;
    voidedAt?: Date | null;
    dunningCompletedAt?: Date | null;
    deletedAt?: Date | null;
  } = {};
  if (body.status !== undefined) set.status = body.status;
  if (body.paidAt !== undefined) set.paidAt = new Date(body.paidAt);
  if (body.voidedAt !== undefined) set.voidedAt = new Date(body.voidedAt);
  if (body.dunningCompletedAt !== undefined)
    set.dunningCompletedAt = new Date(body.dunningCompletedAt);
  if (body.deletedAt !== undefined) set.deletedAt = new Date(body.deletedAt);

  if (Object.keys(set).length > 0) {
    await db
      .update(documentInvoices)
      .set(set)
      .where(eq(documentInvoices.id, id));
  }

  return c.json({ success: true });
});

const paymentFieldConfigBody = z.object({
  id: z.string(),
  publicId: z.string(),
  fieldId: z.string(),
  documentId: z.string(),
  organizationId: z.string(),
  paymentType: z.string(),
  items: z.string(),
  currency: z.string(),
  dueDateTerms: z.string(),
  customDueDays: z.number().optional(),
  customDueDate: z.string().optional(),
  lateFees: z.string().optional(),
  recurringConfig: z.string().optional(),
  installmentsConfig: z.string().optional(),
  depositBalanceConfig: z.string().optional(),
  allowedPaymentMethods: z.string(),
  feeHandling: z.string(),
  taxEnabled: z.boolean(),
  taxBehavior: z.string().optional(),
  totalAmountCents: z.number(),
  providerInvoiceId: z.string().optional(),
  providerSubscriptionId: z.string().optional(),
  providerPaymentIntentId: z.string().optional(),
  hostedInvoiceUrl: z.string().optional(),
  vortexPayableId: z.string().optional(),
  vortexDepositBalancePayableId: z.string().optional(),
  vortexInstallmentPayableId: z.string().optional(),
  vortexRecurringPayableId: z.string().optional(),
  vortexPaymentRequestId: z.string().optional(),
  paymentStatus: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

app.post("/internal/payment-field-configs", async (c) => {
  const parseResult = paymentFieldConfigBody.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: "invalid body" }, 400);
  }

  const body = parseResult.data;
  const db = createD1(c.env.D1);

  const values = {
    id: body.id,
    publicId: body.publicId,
    fieldId: body.fieldId,
    documentId: body.documentId,
    organizationId: body.organizationId,
    paymentType: body.paymentType,
    items: body.items,
    currency: body.currency,
    dueDateTerms: body.dueDateTerms,
    customDueDays: body.customDueDays ?? null,
    customDueDate: body.customDueDate ?? null,
    lateFees: body.lateFees ?? null,
    recurringConfig: body.recurringConfig ?? null,
    installmentsConfig: body.installmentsConfig ?? null,
    depositBalanceConfig: body.depositBalanceConfig ?? null,
    allowedPaymentMethods: body.allowedPaymentMethods,
    feeHandling: body.feeHandling,
    taxEnabled: body.taxEnabled,
    taxBehavior: body.taxBehavior ?? null,
    totalAmountCents: body.totalAmountCents,
    providerInvoiceId: body.providerInvoiceId ?? null,
    providerSubscriptionId: body.providerSubscriptionId ?? null,
    providerPaymentIntentId: body.providerPaymentIntentId ?? null,
    hostedInvoiceUrl: body.hostedInvoiceUrl ?? null,
    vortexPayableId: body.vortexPayableId ?? null,
    vortexDepositBalancePayableId: body.vortexDepositBalancePayableId ?? null,
    vortexInstallmentPayableId: body.vortexInstallmentPayableId ?? null,
    vortexRecurringPayableId: body.vortexRecurringPayableId ?? null,
    vortexPaymentRequestId: body.vortexPaymentRequestId ?? null,
    paymentStatus: body.paymentStatus ?? null,
    createdAt: new Date(body.createdAt),
    updatedAt: new Date(body.updatedAt),
  };

  const { id: _id, ...set } = values;

  await db.insert(paymentFieldConfigs).values(values).onConflictDoUpdate({
    target: paymentFieldConfigs.id,
    set,
  });

  return c.json({ success: true });
});

app.get("/internal/payment-field-configs/:id", async (c) => {
  const db = createD1(c.env.D1);
  const config = await db.query.paymentFieldConfigs.findFirst({
    where: eq(paymentFieldConfigs.id, c.req.param("id")),
  });

  if (!config) {
    return c.json({ error: "not found" }, 404);
  }

  return c.json(config);
});

const paymentFieldConfigUpdateBody = z.object({
  paymentStatus: z.string().optional(),
  vortexPayableId: z.string().optional(),
  vortexRecurringPayableId: z.string().optional(),
  vortexInstallmentPayableId: z.string().optional(),
  vortexDepositBalancePayableId: z.string().optional(),
  vortexPaymentRequestId: z.string().optional(),
  hostedInvoiceUrl: z.string().optional(),
  providerInvoiceId: z.string().optional(),
  providerSubscriptionId: z.string().optional(),
  providerPaymentIntentId: z.string().optional(),
});

app.patch("/internal/payment-field-configs/:id", async (c) => {
  const parseResult = paymentFieldConfigUpdateBody.safeParse(
    await c.req.json()
  );
  if (!parseResult.success) {
    return c.json({ error: "invalid body" }, 400);
  }

  const id = c.req.param("id");
  const body = parseResult.data;
  const db = createD1(c.env.D1);

  const existing = await db.query.paymentFieldConfigs.findFirst({
    where: eq(paymentFieldConfigs.id, id),
  });
  if (!existing) {
    return c.json({ error: "not found" }, 404);
  }

  const set: Record<string, string | null> = {};
  for (const [column, value] of Object.entries(body)) {
    if (value !== undefined) {
      set[column] = value ?? null;
    }
  }

  if (Object.keys(set).length > 0) {
    await db
      .update(paymentFieldConfigs)
      .set(set)
      .where(eq(paymentFieldConfigs.id, id));
  }

  return c.json({ success: true });
});

app.get("/internal/payment-field-configs", async (c) => {
  const documentId = c.req.query("documentId");
  if (!documentId) {
    return c.json({ error: "documentId required" }, 400);
  }

  const db = createD1(c.env.D1);
  const configs = await db.query.paymentFieldConfigs.findMany({
    where: eq(paymentFieldConfigs.documentId, documentId),
  });

  return c.json({ configs });
});

const payableObjectBody = z.object({
  eventId: z.string(),
  payableId: z.string(),
  status: z.union([
    z.literal("paid"),
    z.literal("failed"),
    z.literal("awaiting_payment"),
  ]),
  paymentRequestId: z.string().optional(),
  hostedInvoiceUrl: z.string().optional(),
});

app.post("/internal/webhooks/vortex-billing/payable-object", async (c) => {
  const parseResult = payableObjectBody.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: "invalid body" }, 400);
  }

  const result = await projectPayableObjectUpdated(c.env, parseResult.data);
  return c.json(result);
});

const invoiceEventBody = z.object({
  eventId: z.string(),
  organizationId: z.string(),
  externalCustomerId: z.string(),
  externalSubscriptionId: z.string(),
  externalPriceId: z.string().optional(),
  externalProductId: z.string().optional(),
  invoiceNumber: z.string(),
  invoiceStatus: z.string(),
  status: z.union([
    z.literal("active"),
    z.literal("past_due"),
    z.literal("canceled"),
    z.literal("trialing"),
    z.literal("paused"),
    z.literal("incomplete"),
    z.literal("incomplete_expired"),
    z.literal("unpaid"),
  ]),
  cancelAtPeriodEnd: z.boolean().default(false),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
  latestInvoiceStatus: z.string(),
  metadata: z.string().optional(),
});

app.post("/internal/webhooks/vortex-billing/invoice", async (c) => {
  const parseResult = invoiceEventBody.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: "invalid body" }, 400);
  }

  const body = parseResult.data;
  const db = createD1(c.env.D1);
  const now = new Date();

  const existing = await db.query.subscriptions.findFirst({
    where: eq(
      subscriptions.externalSubscriptionId,
      body.externalSubscriptionId
    ),
  });

  const base = {
    organizationId: body.organizationId,
    externalCustomerId: body.externalCustomerId,
    externalSubscriptionId: body.externalSubscriptionId,
    externalPriceId: body.externalPriceId ?? null,
    externalProductId: body.externalProductId ?? null,
    status: body.status,
    cancelAtPeriodEnd: body.cancelAtPeriodEnd,
    latestInvoiceId: body.invoiceNumber,
    latestInvoiceStatus: body.latestInvoiceStatus,
    currentPeriodStart: body.currentPeriodStart
      ? new Date(body.currentPeriodStart)
      : null,
    currentPeriodEnd: body.currentPeriodEnd
      ? new Date(body.currentPeriodEnd)
      : null,
    metadata: body.metadata ?? null,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(subscriptions)
      .set(base)
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      ...base,
      id: crypto.randomUUID(),
      publicId: body.externalSubscriptionId,
      createdAt: now,
    });
  }

  return c.json({ success: true });
});

const subscriptionEventBody = z.object({
  eventId: z.string(),
  organizationId: z.string(),
  externalCustomerId: z.string(),
  externalSubscriptionId: z.string(),
  externalPriceId: z.string(),
  externalProductId: z.string().optional(),
  status: z.union([
    z.literal("active"),
    z.literal("past_due"),
    z.literal("canceled"),
    z.literal("trialing"),
    z.literal("paused"),
    z.literal("incomplete"),
    z.literal("incomplete_expired"),
    z.literal("unpaid"),
  ]),
  cancelAtPeriodEnd: z.boolean().default(false),
  currentPeriodStart: z.number().optional(),
  currentPeriodEnd: z.number().optional(),
  canceledAt: z.number().optional(),
  cancelReason: z.string().optional(),
  latestInvoiceId: z.string().optional(),
  metadata: z.string().optional(),
});

app.post("/internal/webhooks/vortex-billing/subscription", async (c) => {
  const parseResult = subscriptionEventBody.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: "invalid body" }, 400);
  }

  const body = parseResult.data;
  const db = createD1(c.env.D1);
  const now = new Date();

  const existing = await db.query.subscriptions.findFirst({
    where: eq(
      subscriptions.externalSubscriptionId,
      body.externalSubscriptionId
    ),
  });

  const base = {
    organizationId: body.organizationId,
    externalCustomerId: body.externalCustomerId,
    externalSubscriptionId: body.externalSubscriptionId,
    externalPriceId: body.externalPriceId,
    externalProductId: body.externalProductId ?? null,
    status: body.status,
    cancelAtPeriodEnd: body.cancelAtPeriodEnd,
    currentPeriodStart: body.currentPeriodStart
      ? new Date(body.currentPeriodStart)
      : null,
    currentPeriodEnd: body.currentPeriodEnd
      ? new Date(body.currentPeriodEnd)
      : null,
    canceledAt: body.canceledAt ? new Date(body.canceledAt) : null,
    cancelReason: body.cancelReason ?? null,
    latestInvoiceId: body.latestInvoiceId ?? null,
    metadata: body.metadata ?? null,
    updatedAt: now,
  };

  if (existing) {
    await db
      .update(subscriptions)
      .set(base)
      .where(eq(subscriptions.id, existing.id));
  } else {
    await db.insert(subscriptions).values({
      ...base,
      id: crypto.randomUUID(),
      publicId: body.externalSubscriptionId,
      createdAt: now,
    });
  }

  if (body.status === "active" || body.status === "trialing") {
    await db
      .update(subscriptions)
      .set({
        status: "canceled",
        canceledAt: now,
        cancelReason: "replaced_by_vortex_billing_subscription",
        updatedAt: now,
      })
      .where(
        and(
          eq(subscriptions.organizationId, body.organizationId),
          not(
            eq(
              subscriptions.externalSubscriptionId,
              body.externalSubscriptionId
            )
          ),
          or(
            eq(subscriptions.status, "active"),
            eq(subscriptions.status, "trialing")
          )
        )
      );
  }

  return c.json({ success: true });
});

app.get(
  "/internal/organizations/:organizationId/subscription-plan",
  async (c) => {
    const organizationId = c.req.param("organizationId");
    const db = createD1(c.env.D1);

    const now = Date.now();
    const recent = await db
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

    const paid =
      recent.find((s) => s.status === "active" || s.status === "trialing") ??
      recent.find((s) => {
        if (s.status !== "past_due") return false;
        const since = (s.pastDueSince ?? s.createdAt).getTime();
        return now - since <= 14 * 24 * 60 * 60 * 1000;
      });

    const metadataSchema = z.object({ tier: z.string().optional() });
    let tier: string | undefined;
    if (paid?.metadata != null) {
      try {
        const parsed = metadataSchema.safeParse(JSON.parse(paid.metadata));
        if (parsed.success) {
          tier = parsed.data.tier;
        }
      } catch {
        // ignore malformed metadata
      }
    }

    const plan: "free" | "pro" | "enterprise" =
      tier === "enterprise" ? "enterprise" : tier === "pro" ? "pro" : "free";

    return c.json({
      isPro: plan === "pro" || plan === "enterprise",
      isEnterprise: plan === "enterprise",
      plan,
    });
  }
);

app.get(
  "/internal/organizations/:organizationId/has-active-non-vortex-provider-subscription",
  async (c) => {
    const organizationId = c.req.param("organizationId");
    const db = createD1(c.env.D1);

    const nonVortexProviderIdPattern = /^(cus|sub|price|prod)_/u;
    const active = await db
      .select({
        externalCustomerId: subscriptions.externalCustomerId,
        externalSubscriptionId: subscriptions.externalSubscriptionId,
        externalPriceId: subscriptions.externalPriceId,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, organizationId),
          eq(subscriptions.status, "active")
        )
      );

    const hasActive = active.some(
      (s) =>
        nonVortexProviderIdPattern.test(s.externalCustomerId) ||
        nonVortexProviderIdPattern.test(s.externalSubscriptionId) ||
        nonVortexProviderIdPattern.test(s.externalPriceId ?? "")
    );

    return c.json({ hasActive });
  }
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/.well-known/oauth-authorization-server/seal-mcp", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(buildAuthorizationServerMetadata(origin));
});

app.all("/api/auth/*", (c) => {
  const auth = c.get("auth");
  return auth.handler(c.req.raw);
});

app.route("/api/activity", activity);
app.route("/api/ai", ai);
app.route("/api/analytics", analytics);
app.route("/api/contacts", contacts);
app.route("/api/documents", documents);
app.route("/api/feedback", feedback);
app.route("/api/folders", folders);
app.route("/oauth/seal-mcp", mcpOauth);
app.route("/api/notifications", notifications);
app.route("/api/organizations", organizations);
app.route("/api/public", publicApi);
app.route("/api/saved-signatures", savedSignatures);
app.route("/api/users", users);

app.route("/api/v1/organizations/:organizationSlug/tokens", tokensV1);
app.route("/api/v1/organizations/:organizationSlug/audit", auditLogsV1);

app.use("/api/v1/*", async (c, next) => {
  if (c.req.path === "/api/v1/uploads" && c.req.method === "POST") {
    return next();
  }
  if (
    c.req.path === "/api/v1/documents/download-file" &&
    c.req.method === "GET"
  ) {
    return next();
  }

  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    const raw = header.slice("Bearer ".length).trim();
    if (isApiTokenFormat(raw)) {
      await loadApiTokenContext(c, raw);
    }
  }

  if (c.get("mcp")?.kind === "api") {
    return next();
  }

  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const token = header.slice("Bearer ".length).trim();
  const payload = await verifyMcpAccessToken(c.env, token);
  if (!payload) {
    return c.json({ error: "unauthorized" }, 401);
  }

  c.set("mcp", payload);
  return next();
});
app.route("/api/v1/account", accountV1);
app.route("/api/v1/analytics", analyticsV1);
app.route("/api/v1/audit-log", auditV1);
app.route("/api/v1/contacts", contactsV1);
app.route("/api/v1/documents", documentsV1);
app.route("/api/v1/folders", foldersV1);
app.route("/api/v1/imports", importsV1);
app.route("/api/v1/members", membersV1);
app.route("/api/v1/recipients", recipientsV1);
app.route("/api/v1/search", searchV1);
app.route("/api/v1/settings", settingsV1);
app.route("/api/v1/signatures", signaturesV1);
app.route("/api/v1/templates", templatesV1);
app.route("/api/v1/uploads", uploadsV1);
app.route("/api/v1/webhooks", webhooksV1);
app.route("/api/v1/organizations/:organizationSlug/billing", billingV1);
app.route("/api/v1/organizations/:organizationSlug/usage", usageV1);

export default app;

/**
 * Service-binding-only entrypoint for `/internal/*`.
 * Bind as `entrypoint = "InternalApi"` from other Workers on this account.
 * Rewrites internet-facing hostnames so callers may pass the public URL
 * shape without the public hostname gate rejecting the request.
 */
export class InternalApi extends WorkerEntrypoint<CloudflareBindings> {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (isInternetFacingHostname(url.hostname)) {
      url.hostname = "internal";
      request = new Request(url, request);
    }
    return app.fetch(request, this.env, this.ctx);
  }
}

export const scheduled: ExportedHandlerScheduledHandler<
  CloudflareBindings
> = async (_event, env, _ctx) => {
  await runScheduledTasks(env);
};
