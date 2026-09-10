import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  documents,
  organization,
  paymentFieldConfigs,
  recipients,
  signatureFields,
  signatures,
  user as userTable,
} from "../global/schema.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
}>();

const tokenParamsSchema = z.object({
  token: z.string(),
});

const signingRecipientSchema = z.object({
  publicId: z.string(),
  name: z.string().nullable().optional(),
  email: z.string(),
  role: z.string(),
  order: z.number().int(),
  status: z.string(),
  esignConsentAt: z.number().nullable().optional(),
  awaitingDictation: z.boolean(),
});

const signingDocumentSchema = z.object({
  publicId: z.string(),
  name: z.string(),
  status: z.string(),
  description: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  pageCount: z.number().int().nullable().optional(),
  redirectUrl: z.string().nullable().optional(),
});

const sequentialProgressSchema = z.object({
  total: z.number().int(),
  completed: z.number().int(),
  percentComplete: z.number(),
  currentGroup: z.number().int(),
  isWaitingForPreviousGroup: z.boolean(),
});

const signingTokenResponseSchema = z
  .object({
    recipient: signingRecipientSchema,
    document: signingDocumentSchema,
    waitingForPreviousGroup: z.boolean(),
    sequentialProgress: sequentialProgressSchema,
    branding: z
      .object({ logoUrl: z.string().nullable().optional() })
      .optional(),
    signingSettings: z.record(z.string(), z.string()).optional(),
  })
  .openapi("SigningTokenResponse");

const signingTokenRouteDef = createRoute({
  method: "get",
  path: "/signing/{token}",
  request: {
    params: tokenParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: signingTokenResponseSchema },
      },
      description: "Token lookup result",
    },
    400: { description: "Invalid or expired token" },
    404: { description: "Document not found" },
  },
});

app.openapi(signingTokenRouteDef, async (c) => {
  const { token } = c.req.valid("param");
  const db = createD1(c.env.D1);

  const now = Date.now();
  const recipientRows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.signingToken, token))
    .limit(1);

  const recipient = recipientRows[0];
  if (!recipient) {
    return c.json({ error: "Invalid signing token" }, 400);
  }

  if (recipient.tokenExpiresAt && recipient.tokenExpiresAt.getTime() < now) {
    return c.json({ error: "Signing token has expired" }, 400);
  }

  const docRows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, recipient.documentId))
    .limit(1);

  const doc = docRows[0];
  if (!doc || doc.status === "deleted" || doc.documentStatus === "deleted") {
    return c.json({ error: "Document not found" }, 404);
  }

  const ownerRows = await db
    .select({ name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, doc.ownerId))
    .limit(1);
  const owner = ownerRows[0];

  const orgRows = await db
    .select({ logo: organization.logo })
    .from(organization)
    .where(eq(organization.id, doc.organizationId))
    .limit(1);
  const org = orgRows[0];

  const allRecipients = await db
    .select()
    .from(recipients)
    .where(eq(recipients.documentId, doc.id))
    .orderBy(recipients.order);

  const completedCount = allRecipients.filter((r) =>
    ["signed", "approved", "declined"].includes(r.status)
  ).length;

  const currentGroup =
    allRecipients.find((r) => r.status === "pending" && r.order >= 0)?.order ??
    0;
  const waitingForPreviousGroup =
    doc.signingMode === "sequential" &&
    recipient.order > currentGroup &&
    allRecipients.some(
      (r) =>
        r.order < recipient.order &&
        r.status !== "signed" &&
        r.status !== "approved"
    );

  return c.json(
    {
      recipient: {
        publicId: recipient.publicId,
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        order: recipient.order,
        status: recipient.status,
        esignConsentAt: undefined,
        awaitingDictation: false,
      },
      document: {
        publicId: doc.publicId,
        name: doc.name,
        status: doc.status,
        description: doc.description,
        ownerName: owner?.name || owner?.email,
        pageCount: doc.pageCount,
        redirectUrl: doc.redirectUrl,
      },
      waitingForPreviousGroup,
      sequentialProgress: {
        total: allRecipients.length,
        completed: completedCount,
        percentComplete:
          allRecipients.length === 0
            ? 0
            : Math.round((completedCount / allRecipients.length) * 100),
        currentGroup,
        isWaitingForPreviousGroup: waitingForPreviousGroup,
      },
      branding: { logoUrl: org?.logo },
      signingSettings: undefined,
    },
    200
  );
});

const signingFieldSchema = z
  .object({
    id: z.string(),
    publicId: z.string(),
    documentId: z.string(),
    recipientId: z.string().nullable().optional(),
    templateFieldId: z.string().nullable().optional(),
    fieldType: z.string(),
    label: z.string(),
    isRequired: z.boolean(),
    isMainSignature: z.boolean(),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    page: z.number().int(),
    properties: z.unknown().nullable().optional(),
    validationRules: z.unknown().nullable().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
    currentValue: z.string().nullable().optional(),
    currentSignatureImageUrl: z.string().nullable().optional(),
    isFilled: z.boolean(),
    signatureDetails: z
      .object({
        signedAt: z.number(),
        signerName: z.string().nullable().optional(),
        signerEmail: z.string().nullable().optional(),
        signatureMethod: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .openapi("SigningField");

const signingFieldsResponseSchema = z
  .object({
    fields: z.array(signingFieldSchema),
  })
  .openapi("SigningFieldsResponse");

const signingFieldsRouteDef = createRoute({
  method: "get",
  path: "/signing/{token}/fields",
  request: {
    params: tokenParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: signingFieldsResponseSchema },
      },
      description: "Fields for the token recipient",
    },
    400: { description: "Invalid or expired token" },
    404: { description: "Document not found" },
  },
});

app.openapi(signingFieldsRouteDef, async (c) => {
  const { token } = c.req.valid("param");
  const db = createD1(c.env.D1);

  const now = Date.now();
  const recipientRows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.signingToken, token))
    .limit(1);

  const recipient = recipientRows[0];
  if (!recipient) {
    return c.json({ error: "Invalid signing token" }, 400);
  }

  if (recipient.tokenExpiresAt && recipient.tokenExpiresAt.getTime() < now) {
    return c.json({ error: "Signing token has expired" }, 400);
  }

  const docRows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, recipient.documentId))
    .limit(1);

  const doc = docRows[0];
  if (!doc || doc.status === "deleted" || doc.documentStatus === "deleted") {
    return c.json({ error: "Document not found" }, 404);
  }

  const fields = await db
    .select()
    .from(signatureFields)
    .where(
      and(
        eq(signatureFields.documentId, doc.id),
        eq(signatureFields.recipientId, recipient.id)
      )
    )
    .orderBy(signatureFields.page, signatureFields.createdAt);

  const signatureRows = await db
    .select()
    .from(signatures)
    .where(
      and(
        eq(signatures.documentId, doc.id),
        eq(signatures.recipientId, recipient.id)
      )
    );

  const byFieldId = new Map<string, (typeof signatureRows)[0]>();
  for (const sig of signatureRows) {
    if (sig.fieldId && !byFieldId.has(sig.fieldId)) {
      byFieldId.set(sig.fieldId, sig);
    }
  }

  const withValues = fields.map((field) => {
    const sig = field.id ? byFieldId.get(field.id) : undefined;
    return {
      id: field.id,
      publicId: field.publicId,
      documentId: field.documentId,
      recipientId: field.recipientId,
      templateFieldId: field.templateFieldId,
      fieldType: field.fieldType,
      label: field.label,
      isRequired: field.isRequired,
      isMainSignature: field.isMainSignature,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      page: field.page,
      properties: safeParseJson(field.properties),
      validationRules: safeParseJson(field.validationRules),
      createdAt: field.createdAt.getTime(),
      updatedAt: field.updatedAt.getTime(),
      currentValue: sig?.value ?? null,
      currentSignatureImageUrl: sig?.signatureImageUrl ?? null,
      isFilled: !!sig,
      signatureDetails: sig
        ? {
            signedAt: sig.signedAt?.getTime() ?? Date.now(),
            signerName: recipient.name,
            signerEmail: recipient.email,
            signatureMethod: sig.signatureMethod,
          }
        : null,
    };
  });

  return c.json({ fields: withValues }, 200);
});

const fieldParamsSchema = z.object({
  token: z.string(),
  fieldPublicId: z.string(),
});

const saveFieldValueBodySchema = z.object({
  value: z.string().optional(),
  signatureImageUrl: z.string().optional(),
  signatureMethod: z.enum(["draw", "type", "upload"]).optional(),
  ipAddress: z.string(),
  userAgent: z.string(),
});

const saveFieldValueResponseSchema = z
  .object({
    success: z.boolean(),
  })
  .openapi("SaveFieldValueResponse");

const saveFieldValueRouteDef = createRoute({
  method: "post",
  path: "/signing/{token}/fields/{fieldPublicId}/save",
  request: {
    params: fieldParamsSchema,
    body: {
      content: {
        "application/json": { schema: saveFieldValueBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: saveFieldValueResponseSchema },
      },
      description: "Field value saved",
    },
    400: { description: "Invalid or expired token" },
    403: { description: "Field not assigned to recipient" },
    404: { description: "Field or recipient not found" },
  },
});

app.openapi(saveFieldValueRouteDef, async (c) => {
  const { token, fieldPublicId } = c.req.valid("param");
  const input = c.req.valid("json");
  const db = createD1(c.env.D1);

  const now = Date.now();
  const recipientRows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.signingToken, token))
    .limit(1);

  const recipient = recipientRows[0];
  if (!recipient) {
    return c.json({ error: "Invalid signing token" }, 400);
  }

  if (recipient.tokenExpiresAt && recipient.tokenExpiresAt.getTime() < now) {
    return c.json({ error: "Signing token has expired" }, 400);
  }

  const fieldRows = await db
    .select()
    .from(signatureFields)
    .where(
      and(
        eq(signatureFields.publicId, fieldPublicId),
        eq(signatureFields.documentId, recipient.documentId)
      )
    )
    .limit(1);

  const field = fieldRows[0];
  if (!field) {
    return c.json({ error: "Field not found" }, 404);
  }

  if (field.recipientId !== recipient.id) {
    return c.json(
      { error: "This field is not assigned to this recipient" },
      403
    );
  }

  const existing = await db
    .select()
    .from(signatures)
    .where(
      and(
        eq(signatures.documentId, recipient.documentId),
        eq(signatures.recipientId, recipient.id),
        eq(signatures.fieldId, field.id)
      )
    )
    .limit(1);

  const signedAt = new Date();
  const isSignature =
    field.fieldType === "signature" && input.signatureImageUrl;

  if (existing[0]) {
    await db
      .update(signatures)
      .set({
        value: input.value ?? existing[0].value,
        signatureImageUrl: isSignature
          ? input.signatureImageUrl
          : existing[0].signatureImageUrl,
        signatureMethod: isSignature
          ? input.signatureMethod
          : existing[0].signatureMethod,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        signedAt: input.signatureImageUrl ? signedAt : existing[0].signedAt,
        updatedAt: signedAt,
      })
      .where(eq(signatures.id, existing[0].id));
  } else {
    await db.insert(signatures).values({
      id: crypto.randomUUID(),
      documentId: recipient.documentId,
      recipientId: recipient.id,
      fieldId: field.id,
      value: input.value,
      signatureImageUrl: input.signatureImageUrl,
      signatureMethod: input.signatureMethod,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      signedAt: input.signatureImageUrl ? signedAt : undefined,
      createdAt: signedAt,
      updatedAt: signedAt,
    });
  }

  return c.json({ success: true });
});

const submitBodySchema = z.object({
  status: z.enum(["viewed", "signed", "approved", "declined"]),
  signatureData: z.string().optional(),
  signatureType: z.enum(["draw", "type", "upload"]).optional(),
  declineReason: z.string().optional(),
  ipAddress: z.string(),
  userAgent: z.string(),
});

const submitResponseSchema = z
  .object({
    success: z.boolean(),
  })
  .openapi("SubmitSigningResponse");

const submitRouteDef = createRoute({
  method: "post",
  path: "/signing/{token}/submit",
  request: {
    params: tokenParamsSchema,
    body: {
      content: {
        "application/json": { schema: submitBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: submitResponseSchema },
      },
      description: "Recipient status submitted",
    },
    400: { description: "Invalid or expired token" },
    403: { description: "Already completed" },
    404: { description: "Document not found" },
  },
});

app.openapi(submitRouteDef, async (c) => {
  const { token } = c.req.valid("param");
  const input = c.req.valid("json");
  const db = createD1(c.env.D1);

  const now = Date.now();
  const recipientRows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.signingToken, token))
    .limit(1);

  const recipient = recipientRows[0];
  if (!recipient) {
    return c.json({ error: "Invalid signing token" }, 400);
  }

  if (recipient.tokenExpiresAt && recipient.tokenExpiresAt.getTime() < now) {
    return c.json({ error: "Signing token has expired" }, 400);
  }

  const docRows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, recipient.documentId))
    .limit(1);

  const doc = docRows[0];
  if (!doc || doc.status === "deleted" || doc.documentStatus === "deleted") {
    return c.json({ error: "Document not found" }, 404);
  }

  if (doc.status === "completed") {
    return c.json({ error: "Document is already completed" }, 400);
  }

  if (["signed", "approved", "declined"].includes(recipient.status)) {
    return c.json({ error: "Recipient has already completed" }, 403);
  }

  const nowDate = new Date();
  const update: Partial<typeof recipients.$inferInsert> = {
    status: input.status,
    updatedAt: nowDate,
  };

  if (input.status === "viewed") {
    update.viewedAt = nowDate;
  } else if (input.status === "signed" || input.status === "approved") {
    update.signedAt = nowDate;
    if (input.signatureData) {
      update.signatureData = input.signatureData;
      update.signatureType = input.signatureType;
    }
  } else if (input.status === "declined") {
    update.declinedAt = nowDate;
  }

  await db.update(recipients).set(update).where(eq(recipients.id, recipient.id));

  return c.json({ success: true });
});

const pdfRouteDef = createRoute({
  method: "get",
  path: "/signing/{token}/pdf",
  request: {
    params: tokenParamsSchema,
  },
  responses: {
    200: { description: "PDF document" },
    400: { description: "Invalid or expired token" },
    404: { description: "Document or PDF not found" },
    503: { description: "Object storage not configured" },
  },
});

app.openapi(pdfRouteDef, async (c) => {
  const { token } = c.req.valid("param");
  const db = createD1(c.env.D1);

  const now = Date.now();
  const recipientRows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.signingToken, token))
    .limit(1);

  const recipient = recipientRows[0];
  if (!recipient) {
    return c.json({ error: "Invalid signing token" }, 400);
  }

  if (recipient.tokenExpiresAt && recipient.tokenExpiresAt.getTime() < now) {
    return c.json({ error: "Signing token has expired" }, 400);
  }

  const docRows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, recipient.documentId))
    .limit(1);

  const doc = docRows[0];
  if (!doc || !doc.storageKey) {
    return c.json({ error: "Document or file not found" }, 404);
  }

  const bucket = c.env.DOCUMENTS_BUCKET;
  if (!bucket) {
    return c.json({ error: "Object storage not configured" }, 503);
  }

  const object = await bucket.get(doc.storageKey);
  if (!object || !object.body) {
    return c.json({ error: "Document or file not found" }, 404);
  }

  const headers: Record<string, string> = {
    "content-type": object.httpMetadata?.contentType || "application/pdf",
  };
  if (object.size) headers["content-length"] = String(object.size);

  return c.body(object.body, { headers });
});

const paymentConfigSummarySchema = z
  .object({
    id: z.string(),
    publicId: z.string(),
    fieldId: z.string(),
    documentId: z.string(),
    paymentType: z.string(),
    totalAmountCents: z.number().int(),
    currency: z.string(),
    paymentStatus: z.string().nullable().optional(),
  })
  .openapi("PublicPaymentConfigSummary");

const signingPaymentConfigsRouteDef = createRoute({
  method: "get",
  path: "/signing/{token}/payment-configs",
  request: {
    params: tokenParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(paymentConfigSummarySchema) },
      },
      description: "Payment configs for the document",
    },
    400: { description: "Invalid or expired token" },
    404: { description: "Document not found" },
  },
});

app.openapi(signingPaymentConfigsRouteDef, async (c) => {
  const { token } = c.req.valid("param");
  const db = createD1(c.env.D1);

  const now = Date.now();
  const recipientRows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.signingToken, token))
    .limit(1);

  const recipient = recipientRows[0];
  if (!recipient) {
    return c.json({ error: "Invalid signing token" }, 400);
  }

  if (recipient.tokenExpiresAt && recipient.tokenExpiresAt.getTime() < now) {
    return c.json({ error: "Signing token has expired" }, 400);
  }

  const docRows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, recipient.documentId))
    .limit(1);

  const doc = docRows[0];
  if (!doc || doc.status === "deleted" || doc.documentStatus === "deleted") {
    return c.json({ error: "Document not found" }, 404);
  }

  const rows = await db
    .select({
      id: paymentFieldConfigs.id,
      publicId: paymentFieldConfigs.publicId,
      fieldId: paymentFieldConfigs.fieldId,
      documentId: paymentFieldConfigs.documentId,
      paymentType: paymentFieldConfigs.paymentType,
      totalAmountCents: paymentFieldConfigs.totalAmountCents,
      currency: paymentFieldConfigs.currency,
      paymentStatus: paymentFieldConfigs.paymentStatus,
    })
    .from(paymentFieldConfigs)
    .where(eq(paymentFieldConfigs.documentId, doc.id));

  return c.json(rows);
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeParseJson(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export default app;
