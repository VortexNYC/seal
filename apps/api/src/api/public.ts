import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  activity,
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
  _id: z.string(),
  publicId: z.string(),
  name: z.string().nullable().optional(),
  email: z.string(),
  role: z.string(),
  order: z.number().int(),
  status: z.string(),
  esignConsentAt: z.number().nullable().optional(),
  awaitingDictation: z.boolean(),
  expiresAt: z.number().nullable().optional(),
  viewedAt: z.number().nullable().optional(),
  signedAt: z.number().nullable().optional(),
  approvedAt: z.number().nullable().optional(),
  declinedAt: z.number().nullable().optional(),
});

const signingDocumentSchema = z.object({
  _id: z.string(),
  publicId: z.string(),
  name: z.string(),
  status: z.string(),
  workflowStatus: z.string(),
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
  totalGroups: z.number().int(),
  isWaitingForPreviousGroup: z.boolean(),
});

const signingTokenResponseSchema = z
  .object({
    recipient: signingRecipientSchema,
    document: signingDocumentSchema,
    waitingForPreviousGroup: z.boolean(),
    sequentialProgress: sequentialProgressSchema,
    branding: z
      .object({
        _id: z.string().optional(),
        logoUrl: z.string().nullable().optional(),
        brandColor: z.string().nullable().optional(),
        hideSealBranding: z.boolean().optional(),
        customFooterText: z.string().nullable().optional(),
      })
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
    .select({
      id: organization.id,
      logo: organization.logo,
      metadata: organization.metadata,
    })
    .from(organization)
    .where(eq(organization.id, doc.organizationId))
    .limit(1);
  const org = orgRows[0];

  const orgMetadata = safeParseJson(org?.metadata);
  const brandColor =
    typeof orgMetadata?.brandColor === "string" ? orgMetadata.brandColor : null;
  const hideSealBranding =
    typeof orgMetadata?.hideSealBranding === "boolean"
      ? orgMetadata.hideSealBranding
      : false;
  const customFooterText =
    typeof orgMetadata?.customFooterText === "string"
      ? orgMetadata.customFooterText
      : null;

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
        _id: recipient.publicId,
        publicId: recipient.publicId,
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        order: recipient.order,
        status: recipient.status,
        esignConsentAt: recipient.esignConsentAt?.getTime() ?? null,
        awaitingDictation: false,
        expiresAt: recipient.tokenExpiresAt?.getTime() ?? null,
        viewedAt: recipient.viewedAt?.getTime() ?? null,
        signedAt: recipient.signedAt?.getTime() ?? null,
        approvedAt: recipient.approvedAt?.getTime() ?? null,
        declinedAt: recipient.declinedAt?.getTime() ?? null,
      },
      document: {
        _id: doc.publicId,
        publicId: doc.publicId,
        name: doc.name,
        status: doc.status,
        workflowStatus: doc.status,
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
        totalGroups: new Set(allRecipients.map((r) => r.order)).size,
        isWaitingForPreviousGroup: waitingForPreviousGroup,
      },
      branding: {
        _id: org?.id,
        logoUrl: org?.logo,
        brandColor,
        hideSealBranding,
        customFooterText,
      },
      signingSettings: undefined,
    },
    200
  );
});

const signingFieldSchema = z
  .object({
    _id: z.string(),
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
        signerName: z.string().optional(),
        signerEmail: z.string().optional(),
        signatureMethod: z.string().optional(),
      })
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
      _id: field.publicId,
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
            signerName: recipient.name ?? undefined,
            signerEmail: recipient.email,
            signatureMethod: sig.signatureMethod ?? undefined,
          }
        : undefined,
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
    _id: z.string(),
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
      _id: paymentFieldConfigs.publicId,
      id: paymentFieldConfigs.id,
      publicId: paymentFieldConfigs.publicId,
      fieldId: signatureFields.publicId,
      documentId: paymentFieldConfigs.documentId,
      paymentType: paymentFieldConfigs.paymentType,
      totalAmountCents: paymentFieldConfigs.totalAmountCents,
      currency: paymentFieldConfigs.currency,
      paymentStatus: paymentFieldConfigs.paymentStatus,
    })
    .from(paymentFieldConfigs)
    .leftJoin(
      signatureFields,
      eq(paymentFieldConfigs.fieldId, signatureFields.id)
    )
    .where(eq(paymentFieldConfigs.documentId, doc.id));

  return c.json(rows);
});

const consentInputSchema = z.object({
  ipAddress: z.string().optional(),
  consentVersion: z.string().optional(),
});

const consentResponseSchema = z
  .object({
    success: z.boolean(),
    consentAt: z.number(),
  })
  .openapi("PublicSigningConsentResponse");

const consentRouteDef = createRoute({
  method: "post",
  path: "/signing/{token}/consent",
  request: {
    params: tokenParamsSchema,
    body: {
      content: {
        "application/json": { schema: consentInputSchema },
      },
      description: "Consent record input",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: consentResponseSchema },
      },
      description: "Consent recorded",
    },
    400: { description: "Invalid or expired token" },
    404: { description: "Document not found" },
  },
});

app.openapi(consentRouteDef, async (c) => {
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

  const consentAt = new Date(now);
  const ipAddress = input.ipAddress ?? "unknown";
  const consentVersion = input.consentVersion ?? "1.0";

  await db
    .update(recipients)
    .set({
      esignConsentAt: consentAt,
      esignConsentIp: ipAddress,
      esignConsentVersion: consentVersion,
      updatedAt: consentAt,
    })
    .where(eq(recipients.id, recipient.id));

  await db.insert(activity).values({
    id: crypto.randomUUID(),
    organizationId: doc.organizationId,
    action: "recipient.esign_consent",
    actorName: recipient.name ?? recipient.email,
    targetName: doc.name,
    metadata: JSON.stringify({
      consentVersion,
      ipAddress,
      consentAt: now,
    }),
    createdAt: consentAt,
  });

  return c.json({ success: true, consentAt: now });
});

const optOutInputSchema = z.object({
  ipAddress: z.string().optional(),
  method: z.string().optional(),
});

const optOutResponseSchema = z
  .object({ success: z.boolean() })
  .openapi("PublicSigningOptOutResponse");

const optOutRouteDef = createRoute({
  method: "post",
  path: "/signing/{token}/opt-out",
  request: {
    params: tokenParamsSchema,
    body: {
      content: {
        "application/json": { schema: optOutInputSchema },
      },
      description: "Opt-out record input",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: optOutResponseSchema },
      },
      description: "Opt-out recorded",
    },
    400: { description: "Invalid or expired token" },
    404: { description: "Document not found" },
  },
});

app.openapi(optOutRouteDef, async (c) => {
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

  const ipAddress = input.ipAddress ?? "unknown";
  const method = input.method ?? "paper_copy_request";

  await db.insert(activity).values({
    id: crypto.randomUUID(),
    organizationId: doc.organizationId,
    action: "recipient.esign_opt_out",
    actorName: recipient.name ?? recipient.email,
    targetName: doc.name,
    metadata: JSON.stringify({
      method,
      ipAddress,
      optedOutAt: now,
    }),
    createdAt: new Date(now),
  });

  return c.json({ success: true });
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
