import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  documents,
  organization,
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
});

const signingDocumentSchema = z.object({
  publicId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  pageCount: z.number().int().nullable().optional(),
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
    branding: z.object({ logoUrl: z.string().nullable().optional() }).optional(),
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
    404: { description: "Token not found" },
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
    .where(and(eq(documents.id, recipient.documentId)))
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
      (r) => r.order < recipient.order && r.status !== "signed" && r.status !== "approved"
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
      },
      document: {
        publicId: doc.publicId,
        name: doc.name,
        description: doc.description,
        ownerName: owner?.name || owner?.email,
        pageCount: doc.pageCount,
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
    return c.json({ error: "This field is not assigned to this recipient" }, 403);
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

export default app;
