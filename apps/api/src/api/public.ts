import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, count, eq } from "drizzle-orm";

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
import { writeAuditLog } from "../platform/audit-log.js";
import {
  sendDocumentCompletedEmail,
  sendDocumentViewedEmail,
  sendSigningCompleteEmail,
  sendSigningOtpEmail,
} from "../platform/email.js";
import { generateAndStoreCertificateOfCompletion } from "../platform/certificate-store.js";
import { certificateStorageKey } from "../platform/certificate-of-completion.js";
import {
  isSignerAuthVerified,
  markAccessCodeVerified,
  maskEmail,
  normalizeAuthMethod,
  OTP_TTL_MS,
  parseSignerAuthState,
  serializeSignerAuthState,
  startEmailOtpChallenge,
  verifyAccessCode,
  verifyEmailOtpChallenge,
} from "../platform/signer-auth.js";
import {
  commitSigningSubmit,
  RecipientAlreadyCompletedError,
} from "../platform/signing-submit.js";
import { recordUsageEvent } from "../platform/usage-events.js";
import { emitWebhookEvent } from "../platform/webhook-events.js";

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
  authMethod: z.enum(["none", "access_code", "email_otp"]).optional(),
  authVerified: z.boolean().optional(),
  authEmailMasked: z.string().nullable().optional(),
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
        awaitingDictation: recipient.awaitingDictation,
        expiresAt: recipient.tokenExpiresAt?.getTime() ?? null,
        viewedAt: recipient.viewedAt?.getTime() ?? null,
        signedAt: recipient.signedAt?.getTime() ?? null,
        approvedAt: recipient.approvedAt?.getTime() ?? null,
        declinedAt: recipient.declinedAt?.getTime() ?? null,
        authMethod: normalizeAuthMethod(recipient.authMethod),
        authVerified: isSignerAuthVerified(
          recipient.authMethod,
          recipient.authenticationData
        ),
        authEmailMasked:
          normalizeAuthMethod(recipient.authMethod) === "email_otp"
            ? maskEmail(recipient.email)
            : null,
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

const authChallengeBodySchema = z.object({}).optional();

const authChallengeRouteDef = createRoute({
  method: "post",
  path: "/signing/{token}/auth/challenge",
  request: {
    params: tokenParamsSchema,
    body: {
      content: {
        "application/json": { schema: authChallengeBodySchema },
      },
      required: false,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            method: z.enum(["email_otp"]),
            maskedEmail: z.string(),
            expiresInSeconds: z.number().int(),
          }),
        },
      },
      description: "OTP challenge sent",
    },
    400: { description: "Invalid token or method" },
    404: { description: "Document not found" },
  },
});

app.openapi(authChallengeRouteDef, async (c) => {
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

  const method = normalizeAuthMethod(recipient.authMethod);
  if (method !== "email_otp") {
    return c.json({ error: "Email OTP is not required for this recipient" }, 400);
  }

  if (isSignerAuthVerified(recipient.authMethod, recipient.authenticationData)) {
    return c.json({ error: "Already verified" }, 400);
  }

  const docRows = await db
    .select({ id: documents.id, name: documents.name, status: documents.status })
    .from(documents)
    .where(eq(documents.id, recipient.documentId))
    .limit(1);
  const doc = docRows[0];
  if (!doc || doc.status === "deleted") {
    return c.json({ error: "Document not found" }, 404);
  }

  const existing = parseSignerAuthState(recipient.authenticationData);
  const { code, state } = await startEmailOtpChallenge(existing);

  await db
    .update(recipients)
    .set({
      authenticationData: serializeSignerAuthState(state),
      updatedAt: new Date(),
    })
    .where(eq(recipients.id, recipient.id));

  const result = await sendSigningOtpEmail(c.env, {
    to: recipient.email,
    recipientName: recipient.name ?? recipient.email,
    documentName: doc.name,
    code,
    expiresInMinutes: Math.round(OTP_TTL_MS / 60_000),
  });
  if (!result.success) {
    console.error("[public/auth/challenge] otp email failed:", result);
    return c.json({ error: "Failed to send verification email" }, 400);
  }

  return c.json({
    method: "email_otp" as const,
    maskedEmail: maskEmail(recipient.email),
    expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
  });
});

const authVerifyBodySchema = z.object({
  code: z.string().min(1).max(128),
});

const authVerifyRouteDef = createRoute({
  method: "post",
  path: "/signing/{token}/auth/verify",
  request: {
    params: tokenParamsSchema,
    body: {
      content: {
        "application/json": { schema: authVerifyBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean(), method: z.string() }),
        },
      },
      description: "Signer authenticated",
    },
    400: { description: "Invalid code or token" },
    403: { description: "Locked out" },
  },
});

app.openapi(authVerifyRouteDef, async (c) => {
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

  const method = normalizeAuthMethod(recipient.authMethod);
  if (method === "none") {
    return c.json({ success: true, method: "none" });
  }

  if (isSignerAuthVerified(recipient.authMethod, recipient.authenticationData)) {
    return c.json({ success: true, method });
  }

  if (method === "access_code") {
    const ok = await verifyAccessCode(input.code, recipient.accessCodeHash);
    if (!ok) {
      return c.json({ error: "Invalid access code" }, 400);
    }
    await db
      .update(recipients)
      .set({
        authenticationData: serializeSignerAuthState(markAccessCodeVerified()),
        updatedAt: new Date(),
      })
      .where(eq(recipients.id, recipient.id));
    return c.json({ success: true, method: "access_code" });
  }

  const existing = parseSignerAuthState(recipient.authenticationData);
  const result = await verifyEmailOtpChallenge(existing, input.code);
  await db
    .update(recipients)
    .set({
      authenticationData: serializeSignerAuthState(result.state),
      updatedAt: new Date(),
    })
    .where(eq(recipients.id, recipient.id));

  if (!result.ok) {
    if (result.reason === "locked") {
      return c.json({ error: "Too many attempts. Request a new code." }, 403);
    }
    if (result.reason === "expired" || result.reason === "missing") {
      return c.json({ error: "Code expired. Request a new one." }, 400);
    }
    return c.json({ error: "Invalid verification code" }, 400);
  }

  return c.json({ success: true, method: "email_otp" });
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

  if (
    !isSignerAuthVerified(recipient.authMethod, recipient.authenticationData)
  ) {
    return c.json({ error: "Signer authentication required" }, 403);
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

  const auditActor = { type: "user" as const, id: recipient.id };
  const auditBase = {
    organizationId: doc.organizationId,
    actor: auditActor,
    resourceType: "recipient" as const,
    resourceId: recipient.id,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  };
  const recipientMeta = {
    documentId: doc.id,
    publicId: doc.publicId,
    role: recipient.role,
  };

  const auditAction =
    input.status === "viewed"
      ? "recipient.viewed"
      : input.status === "declined"
        ? "recipient.declined"
        : "recipient.signed";

  const auditMetadata =
    input.status === "declined"
      ? { ...recipientMeta, hasReason: !!input.declineReason }
      : recipientMeta;

  // Envelope-level typed/drawn sign (no per-field placement) still needs a
  // signatures row so /api/v1/signatures/audit is not empty for buyers.
  let signatureRow:
    | {
        id: string;
        documentId: string;
        recipientId: string;
        value?: string;
        signatureMethod?: string;
        ipAddress?: string;
        userAgent?: string;
        signedAt: Date;
      }
    | undefined;
  let activityRow:
    | {
        id: string;
        organizationId: string;
        action: string;
        actorName: string;
        targetName: string;
        metadata: Record<string, unknown>;
        createdAt: Date;
      }
    | undefined;

  if (input.status === "signed" || input.status === "approved") {
    const existingEnvelope = await db
      .select({ id: signatures.id })
      .from(signatures)
      .where(
        and(
          eq(signatures.documentId, doc.id),
          eq(signatures.recipientId, recipient.id)
        )
      )
      .limit(1);
    if (!existingEnvelope[0]) {
      signatureRow = {
        id: crypto.randomUUID(),
        documentId: doc.id,
        recipientId: recipient.id,
        value: input.signatureData,
        signatureMethod: input.signatureType ?? "type",
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        signedAt: nowDate,
      };
    }
    activityRow = {
      id: crypto.randomUUID(),
      organizationId: doc.organizationId,
      action: "recipient.signed",
      actorName: recipient.name ?? recipient.email,
      targetName: doc.name,
      metadata: {
        documentId: doc.id,
        publicId: doc.publicId,
        recipientId: recipient.id,
      },
      createdAt: nowDate,
    };
  }

  try {
    await commitSigningSubmit(db, {
      recipientId: recipient.id,
      recipientUpdate: update,
      audit: {
        id: crypto.randomUUID(),
        ...auditBase,
        action: auditAction,
        metadata: auditMetadata,
        createdAt: nowDate,
      },
      signature: signatureRow,
      activityRow,
    });
  } catch (err) {
    if (err instanceof RecipientAlreadyCompletedError) {
      return c.json({ error: "Recipient has already completed" }, 403);
    }
    throw err;
  }

  const [owner] = await db
    .select({ name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.id, doc.ownerId))
    .limit(1);

  const [org] = await db
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, doc.organizationId))
    .limit(1);
  const orgSlug = org?.slug ?? "";

  if (input.status === "viewed" && owner?.email) {
    const result = await sendDocumentViewedEmail(c.env, {
      to: owner.email,
      ownerName: owner.name ?? owner.email,
      documentName: doc.name,
      documentSlug: orgSlug,
      documentPublicId: doc.publicId,
      recipientName: recipient.name ?? recipient.email,
      recipientEmail: recipient.email,
      viewedAt: nowDate.getTime(),
    });
    if (!result.success) {
      console.error("[public/submit] viewed email failed:", result);
    }
  }

  if (input.status === "signed" || input.status === "approved") {
    if (recipient.email) {
      const role: "signer" | "approver" | "viewer" =
        recipient.role === "approver"
          ? "approver"
          : recipient.role === "viewer"
            ? "viewer"
            : "signer";
      const result = await sendSigningCompleteEmail(c.env, {
        to: recipient.email,
        recipientName: recipient.name ?? recipient.email,
        documentName: doc.name,
        signedAt: nowDate.getTime(),
        role,
      });
      if (!result.success) {
        console.error("[public/submit] signing complete email failed:", result);
      }
    }

    if (input.status === "signed" || input.status === "approved") {
      const emitPromise = emitWebhookEvent(c.env, {
        organizationId: doc.organizationId,
        eventType: "recipient.signed",
        payload: {
          documentId: doc.id,
          publicId: doc.publicId,
          recipientId: recipient.id,
          name: recipient.name,
          email: recipient.email,
          status: input.status,
          signedAt: nowDate.getTime(),
        },
      }).catch((err) => {
        console.error("[webhooks] recipient.signed emit failed:", err);
      });
      try {
        if (c.executionCtx?.waitUntil) {
          c.executionCtx.waitUntil(emitPromise);
        } else {
          await emitPromise;
        }
      } catch {
        await emitPromise;
      }
    }

    if (doc.allowDictateNextSigner) {
      const placeholderRows = await db
        .select()
        .from(recipients)
        .where(
          and(
            eq(recipients.documentId, doc.id),
            eq(recipients.isPlaceholder, true)
          )
        )
        .orderBy(recipients.order);
      const nextPlaceholder = placeholderRows.find(
        (r) => r.order > recipient.order
      );
      if (nextPlaceholder) {
        await db
          .update(recipients)
          .set({ awaitingDictation: true, updatedAt: nowDate })
          .where(eq(recipients.id, recipient.id));
      }
    }

    const pendingSigners = await db
      .select({ value: count() })
      .from(recipients)
      .where(
        and(
          eq(recipients.documentId, doc.id),
          eq(recipients.role, "signer"),
          eq(recipients.status, "pending")
        )
      );

    const pendingCount = pendingSigners[0]?.value ?? 0;
    if (pendingCount === 0) {
      await db
        .update(documents)
        .set({
          status: "completed",
          completedAt: nowDate,
          updatedAt: nowDate,
        })
        .where(eq(documents.id, doc.id));

      await db.insert(activity).values({
        id: crypto.randomUUID(),
        organizationId: doc.organizationId,
        action: "document.completed",
        actorName: recipient.name ?? recipient.email,
        targetName: doc.name,
        metadata: JSON.stringify({
          documentId: doc.id,
          publicId: doc.publicId,
        }),
        createdAt: nowDate,
      });

      await writeAuditLog(db, {
        organizationId: doc.organizationId,
        actor: auditActor,
        action: "document.completed",
        resourceType: "document",
        resourceId: doc.id,
        metadata: { publicId: doc.publicId },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      await recordUsageEvent(db, {
        organizationId: doc.organizationId,
        eventType: "document.completed",
        metadata: { documentId: doc.id, publicId: doc.publicId },
      });

      const bucket = c.env.DOCUMENTS_BUCKET;
      const appUrl = c.env.APP_URL;
      if (bucket && appUrl) {
        try {
          await generateAndStoreCertificateOfCompletion({
            db,
            bucket,
            documentId: doc.id,
            appUrl,
          });
        } catch (err) {
          console.error(
            "[public/submit] certificate of completion failed:",
            err
          );
        }
      }

      const emitPromise = emitWebhookEvent(c.env, {
        organizationId: doc.organizationId,
        eventType: "document.completed",
        payload: {
          documentId: doc.id,
          publicId: doc.publicId,
          name: doc.name,
          completedAt: nowDate.getTime(),
        },
      }).catch((err) => {
        console.error("[webhooks] document.completed emit failed:", err);
      });
      try {
        if (c.executionCtx?.waitUntil) {
          c.executionCtx.waitUntil(emitPromise);
        } else {
          await emitPromise;
        }
      } catch {
        await emitPromise;
      }

      if (owner?.email) {
        const allRecipients = await db
          .select({
            name: recipients.name,
            email: recipients.email,
            role: recipients.role,
            status: recipients.status,
            signedAt: recipients.signedAt,
            approvedAt: recipients.approvedAt,
            viewedAt: recipients.viewedAt,
          })
          .from(recipients)
          .where(eq(recipients.documentId, doc.id));

        const recipientsSummary = allRecipients
          .filter((r) => r.status !== "pending")
          .map((r) => ({
            name: r.name ?? r.email ?? "Unknown",
            email: r.email,
            role:
              r.role === "approver"
                ? ("approver" as const)
                : r.role === "viewer"
                  ? ("viewer" as const)
                  : ("signer" as const),
            completedAt:
              r.signedAt?.getTime() ??
              r.approvedAt?.getTime() ??
              r.viewedAt?.getTime() ??
              nowDate.getTime(),
          }));

        const result = await sendDocumentCompletedEmail(c.env, {
          to: owner.email,
          senderName: owner.name ?? owner.email,
          documentName: doc.name,
          documentSlug: orgSlug,
          documentPublicId: doc.publicId,
          completedAt: nowDate.getTime(),
          recipientsSummary,
        });
        if (!result.success) {
          console.error("[public/submit] completed email failed:", result);
        }
      }
    }
  }

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

const signedPdfRouteDef = createRoute({
  method: "get",
  path: "/signing/{token}/signed-pdf",
  request: {
    params: tokenParamsSchema,
  },
  responses: {
    200: { description: "Signed PDF document as attachment" },
    400: { description: "Invalid or expired token" },
    404: { description: "Document or PDF not found" },
    503: { description: "Object storage not configured" },
  },
});

app.openapi(signedPdfRouteDef, async (c) => {
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

  const filename = `${doc.name || "document"}.pdf`;

  const headers: Record<string, string> = {
    "content-type": object.httpMetadata?.contentType || "application/pdf",
    "content-disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  };
  if (object.size) headers["content-length"] = String(object.size);

  return c.body(object.body, { headers });
});

const certificateRouteDef = createRoute({
  method: "get",
  path: "/signing/{token}/certificate",
  request: {
    params: tokenParamsSchema,
  },
  responses: {
    200: { description: "Certificate of Completion PDF" },
    400: { description: "Invalid or expired token" },
    404: { description: "Certificate not found (document not completed)" },
    503: { description: "Object storage not configured" },
  },
});

app.openapi(certificateRouteDef, async (c) => {
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
  if (!doc || doc.status !== "completed") {
    return c.json({ error: "Certificate not available until completed" }, 404);
  }

  const bucket = c.env.DOCUMENTS_BUCKET;
  if (!bucket) {
    return c.json({ error: "Object storage not configured" }, 503);
  }

  const key = certificateStorageKey(doc.organizationId, doc.id);
  let object = await bucket.get(key);
  if (!object || !object.body) {
    // Lazy generate if completion raced before storage was ready.
    if (c.env.APP_URL) {
      await generateAndStoreCertificateOfCompletion({
        db,
        bucket,
        documentId: doc.id,
        appUrl: c.env.APP_URL,
      });
      object = await bucket.get(key);
    }
  }
  if (!object || !object.body) {
    return c.json({ error: "Certificate not found" }, 404);
  }

  const filename = `${doc.name || "document"}-certificate.pdf`;
  const headers: Record<string, string> = {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
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

const dictateBodySchema = z.object({
  nextName: z.string(),
  nextEmail: z.string().email(),
});

const dictateResponseSchema = z
  .object({ success: z.boolean() })
  .openapi("PublicSigningDictateResponse");

const dictateRouteDef = createRoute({
  method: "post",
  path: "/signing/{token}/dictate",
  request: {
    params: tokenParamsSchema,
    body: {
      content: {
        "application/json": { schema: dictateBodySchema },
      },
      description: "Next signer designation input",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: dictateResponseSchema },
      },
      description: "Next signer designated",
    },
    400: { description: "Invalid or expired token" },
    403: { description: "Not allowed to dictate" },
    404: { description: "Document or placeholder not found" },
  },
});

app.openapi(dictateRouteDef, async (c) => {
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

  if (recipient.status !== "signed" && recipient.status !== "approved") {
    return c.json(
      { error: "Only completed signers can designate the next recipient" },
      403
    );
  }

  if (!recipient.awaitingDictation) {
    return c.json({ error: "No dictation required for this recipient" }, 403);
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

  if (!doc.allowDictateNextSigner) {
    return c.json({ error: "This document does not support dictation" }, 403);
  }

  const placeholderRows = await db
    .select()
    .from(recipients)
    .where(
      and(eq(recipients.documentId, doc.id), eq(recipients.isPlaceholder, true))
    )
    .orderBy(recipients.order);

  const nextPlaceholder = placeholderRows.find(
    (r) => r.order > recipient.order
  );
  if (!nextPlaceholder) {
    return c.json(
      { error: "No placeholder recipient found in the next signing group" },
      404
    );
  }

  const newToken = crypto.randomUUID();
  const tokenExpiration = new Date(now + 30 * 24 * 60 * 60 * 1000);
  const nowDate = new Date(now);

  await db
    .update(recipients)
    .set({
      name: input.nextName.trim(),
      email: input.nextEmail.trim().toLowerCase(),
      isPlaceholder: false,
      dictatedBy: recipient.id,
      dictatedAt: nowDate,
      signingToken: newToken,
      tokenHash: newToken,
      tokenExpiresAt: tokenExpiration,
      updatedAt: nowDate,
    })
    .where(eq(recipients.id, nextPlaceholder.id));

  await db
    .update(recipients)
    .set({ awaitingDictation: false, updatedAt: nowDate })
    .where(eq(recipients.id, recipient.id));

  await db.insert(activity).values({
    id: crypto.randomUUID(),
    organizationId: doc.organizationId,
    action: "recipient.dictated",
    actorName: recipient.name ?? recipient.email,
    targetName: doc.name,
    metadata: JSON.stringify({
      nextRecipientId: nextPlaceholder.id,
      nextName: input.nextName,
      nextEmail: input.nextEmail,
      dictatedAt: now,
    }),
    createdAt: nowDate,
  });

  return c.json({ success: true });
});

const attachmentUploadBodySchema = z.object({
  contentBase64: z.string().min(1),
  contentType: z.string().optional(),
});

const attachmentUploadResponseSchema = z
  .object({
    storageKey: z.string(),
    contentType: z.string(),
    size: z.number().int(),
  })
  .openapi("AttachmentUploadResponse");

const attachmentUploadRouteDef = createRoute({
  method: "post",
  path: "/signing/{token}/attachments",
  request: {
    params: tokenParamsSchema,
    body: {
      content: {
        "application/json": { schema: attachmentUploadBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: attachmentUploadResponseSchema },
      },
      description: "Attachment uploaded",
    },
    400: { description: "Invalid or expired token" },
    503: { description: "Object storage not configured" },
  },
});

app.openapi(attachmentUploadRouteDef, async (c) => {
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

  const bucket = c.env.DOCUMENTS_BUCKET;
  if (!bucket) {
    return c.json({ error: "Object storage not configured" }, 503);
  }

  const bytes = base64ToBytes(input.contentBase64);
  const contentType = input.contentType || "application/octet-stream";
  const key = `attachments/${recipient.documentId}/${crypto.randomUUID()}`;

  await bucket.put(key, bytes, { httpMetadata: { contentType } });

  return c.json({ storageKey: key, contentType, size: bytes.length });
});

function base64ToBytes(value: string) {
  const binary = atob(value);
  return new Uint8Array(Array.from(binary, (char) => char.charCodeAt(0)));
}

const qrTokenParamsSchema = z.object({
  qrToken: z.string(),
});

const signerSchema = z.object({
  name: z.string(),
  maskedEmail: z.string(),
  role: z.string(),
  signedAt: z.number().nullable(),
});

const verifyResultSchema = z
  .object({
    verified: z.boolean(),
    documentName: z.string(),
    completedAt: z.number().nullable(),
    signerCount: z.number().int(),
    signers: z.array(signerSchema),
    documentHash: z.string().nullable(),
    createdAt: z.number(),
  })
  .openapi("VerifyResult");

const verifyResponseSchema = verifyResultSchema.nullable();

const verifyRouteDef = createRoute({
  method: "get",
  path: "/verify/{qrToken}",
  request: {
    params: qrTokenParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: verifyResponseSchema },
      },
      description: "Public document verification result",
    },
    400: { description: "Invalid token" },
  },
});

app.openapi(verifyRouteDef, async (c) => {
  const { qrToken } = c.req.valid("param");
  const db = createD1(c.env.D1);

  const docRows = await db
    .select()
    .from(documents)
    .where(eq(documents.qrToken, qrToken))
    .limit(1);

  const doc = docRows[0];
  if (!doc || doc.status !== "completed" || doc.documentStatus === "deleted") {
    return c.json(null, 200);
  }

  type PublicSigner = {
    name: string;
    maskedEmail: string;
    role: string;
    signedAt: number | null;
  };

  const signers: PublicSigner[] = [];
  const recipientRows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.documentId, doc.id));

  for (const r of recipientRows) {
    if (r.status !== "signed" && r.status !== "approved") {
      continue;
    }
    signers.push({
      name: r.name ?? r.email,
      maskedEmail: maskEmail(r.email),
      role: r.role,
      signedAt: r.signedAt?.getTime() ?? r.approvedAt?.getTime() ?? null,
    });
  }

  return c.json({
    verified: true,
    documentName: doc.name,
    completedAt: doc.completedAt ? doc.completedAt.getTime() : null,
    signerCount: signers.length,
    signers,
    documentHash: doc.documentHash ?? null,
    createdAt: doc.createdAt.getTime(),
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeParseJson(
  value: string | null | undefined
): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const ipResponseSchema = z.object({
  ip: z.string(),
});

const ipRouteDef = createRoute({
  method: "get",
  path: "/ip",
  responses: {
    200: {
      content: {
        "application/json": { schema: ipResponseSchema },
      },
      description: "Client IP address for audit trail",
    },
  },
});

app.openapi(ipRouteDef, (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  return c.json({ ip });
});

export default app;
