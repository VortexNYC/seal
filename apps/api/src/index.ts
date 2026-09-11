import { OpenAPIHono } from "@hono/zod-openapi";
import { routeAgentRequest } from "agents";
import { cors } from "hono/cors";
import { z } from "zod";

import { authenticateAgentConnection } from "./agents/auth.js";
import { SealChatAgent } from "./agents/seal-chat-agent.js";
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
import auditV1 from "./api/v1/audit.js";
import contactsV1 from "./api/v1/contacts.js";
import documentsV1 from "./api/v1/documents.js";
import membersV1 from "./api/v1/members.js";
import recipientsV1 from "./api/v1/recipients.js";
import settingsV1 from "./api/v1/settings.js";
import signaturesV1 from "./api/v1/signatures.js";
import templatesV1 from "./api/v1/templates.js";
import uploadsV1 from "./api/v1/uploads.js";
import webhooksV1 from "./api/v1/webhooks.js";
import { createD1 } from "./global/db.js";
import { documentInvoices, paymentFieldConfigs } from "./global/schema.js";
import { createAuth } from "./platform/auth.js";
import { sendEmail } from "./platform/email.js";
import {
  verifyMcpAccessToken,
  type McpAccessToken,
} from "./platform/mcp-auth.js";
import { runScheduledTasks } from "./platform/scheduled.js";
import { getSessionUser, type SessionUser } from "./platform/session.js";
import { projectPayableObjectUpdated } from "./platform/vortex_billing.js";

type Variables = {
  auth: ReturnType<typeof createAuth>;
  user: SessionUser | null;
  mcp?: McpAccessToken;
};

interface Env extends CloudflareBindings {
  SealChatAgent: DurableObjectNamespace<SealChatAgent>;
}

const app = new OpenAPIHono<{
  Bindings: Env;
  Variables: Variables;
}>();

// Agent WebSocket/HTTP routing runs before CORS and the auth middleware so
// that `routeAgentRequest` can handle `/agents/...` upgrades directly.
app.use("*", async (c, next) => {
  if (!c.req.path.startsWith("/agents/")) {
    return next();
  }

  const agentResponse = await routeAgentRequest(c.req.raw, c.env, {
    prefix: "agents",
    onBeforeConnect: async (req, lobby) => {
      const authResult = await authenticateAgentConnection(
        req,
        lobby.name,
        c.env
      );
      return authResult ?? req;
    },
    onBeforeRequest: async (req, lobby) => {
      const authResult = await authenticateAgentConnection(
        req,
        lobby.name,
        c.env
      );
      return authResult ?? req;
    },
  });

  if (agentResponse) {
    return agentResponse;
  }

  return next();
});

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

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Vortex Sign API",
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
  const key = c.req.header("x-internal-api-key");
  if (key !== c.env.INTERNAL_API_KEY) {
    return c.json({ error: "unauthorized" }, 401);
  }

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
  const key = c.req.header("x-internal-api-key");
  if (key !== c.env.INTERNAL_API_KEY) {
    return c.json({ error: "unauthorized" }, 401);
  }

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
  const key = c.req.header("x-internal-api-key");
  if (key !== c.env.INTERNAL_API_KEY) {
    return c.json({ error: "unauthorized" }, 401);
  }

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
  const key = c.req.header("x-internal-api-key");
  if (key !== c.env.INTERNAL_API_KEY) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const parseResult = payableObjectBody.safeParse(await c.req.json());
  if (!parseResult.success) {
    return c.json({ error: "invalid body" }, 400);
  }

  const result = await projectPayableObjectUpdated(c.env, parseResult.data);
  return c.json(result);
});

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
app.route("/api/v1/members", membersV1);
app.route("/api/v1/recipients", recipientsV1);
app.route("/api/v1/settings", settingsV1);
app.route("/api/v1/signatures", signaturesV1);
app.route("/api/v1/templates", templatesV1);
app.route("/api/v1/uploads", uploadsV1);
app.route("/api/v1/webhooks", webhooksV1);

export { SealChatAgent };

export default app;

export const scheduled: ExportedHandlerScheduledHandler<Env> = async (
  _event,
  env,
  _ctx
) => {
  await runScheduledTasks(env);
};
