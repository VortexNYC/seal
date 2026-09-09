import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  count,
  eq,
  and,
  desc,
  asc,
  gte,
  lt,
  inArray,
  isNull,
  not,
  type SQL,
} from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  activity,
  documentAccess,
  documents,
  folders,
  member,
  paymentFieldConfigs,
  recipients,
  signatureFields,
  signatures,
  user as userTable,
} from "../global/schema.js";

const DocumentSchema = z
  .object({
    id: z.string(),
    publicId: z.string(),
    organizationId: z.string(),
    ownerId: z.string(),
    folderId: z.string().nullable().optional(),
    name: z.string(),
    description: z.string().nullable().optional(),
    status: z.string(),
    documentStatus: z.string(),
    workflowStatus: z.string(),
    sharingMode: z.string(),
    signingMode: z.string().nullable().optional(),
    aiProcessingStatus: z.string().nullable().optional(),
    storageKey: z.string().nullable().optional(),
    contentType: z.string().nullable().optional(),
    size: z.number().int().nullable().optional(),
    fileSize: z.number().int().nullable().optional(),
    pageCount: z.number().int().nullable().optional(),
    thumbnailDataUrl: z.string().nullable().optional(),
    redirectUrl: z.string().nullable().optional(),
    allowDictateNextSigner: z.boolean(),
    sentAt: z.number().nullable().optional(),
    deadline: z.number().nullable().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("Document");

const FileSchema = z
  .object({
    storageKey: z.string(),
    contentType: z.string(),
    size: z.number().int(),
  })
  .openapi("DocumentFile");

function documentResponse(doc: {
  id: string;
  publicId: string;
  organizationId: string;
  ownerId: string;
  folderId: string | null;
  name: string;
  description: string | null;
  status: string;
  documentStatus: string;
  sharingMode: string;
  signingMode: string | null;
  aiProcessingStatus: string | null;
  storageKey: string | null;
  contentType: string | null;
  size: number | null;
  pageCount: number | null;
  thumbnailDataUrl: string | null;
  redirectUrl: string | null;
  allowDictateNextSigner: boolean;
  sentAt: Date | null;
  deadline: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: doc.id,
    publicId: doc.publicId,
    organizationId: doc.organizationId,
    ownerId: doc.ownerId,
    folderId: doc.folderId,
    name: doc.name,
    description: doc.description,
    status: doc.status,
    documentStatus: doc.documentStatus,
    workflowStatus: doc.status,
    sharingMode: doc.sharingMode,
    signingMode: doc.signingMode,
    aiProcessingStatus: doc.aiProcessingStatus,
    storageKey: doc.storageKey,
    contentType: doc.contentType,
    size: doc.size,
    fileSize: doc.size,
    pageCount: doc.pageCount,
    thumbnailDataUrl: doc.thumbnailDataUrl,
    redirectUrl: doc.redirectUrl,
    allowDictateNextSigner: doc.allowDictateNextSigner,
    sentAt: doc.sentAt ? doc.sentAt.getTime() : null,
    deadline: doc.deadline ? doc.deadline.getTime() : null,
    createdAt: doc.createdAt.getTime(),
    updatedAt: doc.updatedAt.getTime(),
  };
}

function generatePublicId() {
  return crypto.randomUUID();
}

function generateSigningToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

function validateRedirectUrl(redirectUrl: string | null | undefined): void {
  if (!redirectUrl) {
    return;
  }

  try {
    const parsed = new URL(redirectUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Redirect URL must use http or https protocol");
    }
  } catch {
    throw new Error("Redirect URL must be a valid URL");
  }

  if (redirectUrl.length > 2048) {
    throw new Error("Redirect URL must be 2048 characters or less");
  }
}

async function hasEditDocumentAccess(
  db: ReturnType<typeof createD1>,
  document: {
    id: string;
    ownerId: string;
    organizationId: string;
  },
  userId: string
): Promise<boolean> {
  if (document.ownerId === userId) {
    return true;
  }

  const rows = await db
    .select({ permissionLevel: documentAccess.permissionLevel })
    .from(documentAccess)
    .where(
      and(
        eq(documentAccess.documentId, document.id),
        eq(documentAccess.userId, userId)
      )
    )
    .limit(1);

  const access = rows[0];
  return (
    access?.permissionLevel === "edit" || access?.permissionLevel === "manage"
  );
}

function r2Key(organizationId: string, publicId: string) {
  return `${organizationId}/documents/${publicId}`;
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return new Uint8Array(Array.from(binary, (char) => char.charCodeAt(0)));
}

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { user: import("../platform/session.js").SessionUser | null };
}>();

app.use("/*", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const activeOrganizationId = user.session?.activeOrganizationId;
  if (!activeOrganizationId) {
    return c.json({ error: "No active organization" }, 403);
  }
  return next();
});

const createDocumentBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  fileSize: z.number().int().optional(),
  contentType: z.string().optional(),
  pageCount: z.number().int().optional(),
  thumbnailDataUrl: z.string().optional(),
  folderId: z.string().optional(),
});

const createRouteDef = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": { schema: createDocumentBodySchema },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: DocumentSchema } },
      description: "Document created",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
    404: { description: "Folder not found" },
  },
});

app.openapi(createRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const input = c.req.valid("json");

  const db = createD1(c.env.D1);
  const publicId = generatePublicId();
  const now = new Date();

  const documentId = crypto.randomUUID();

  let folderInternalId: string | null = null;
  if (input.folderId) {
    const folderRows = await db
      .select({ id: folders.id })
      .from(folders)
      .where(
        and(
          eq(folders.publicId, input.folderId),
          eq(folders.organizationId, organizationId)
        )
      )
      .limit(1);
    const folder = folderRows[0];
    if (!folder) {
      return c.json({ error: "Folder not found" }, 404);
    }
    folderInternalId = folder.id;
  }

  await db.insert(documents).values({
    id: documentId,
    publicId,
    organizationId,
    ownerId: user!.user.id,
    folderId: folderInternalId,
    name: input.name,
    description: input.description ?? null,
    status: "draft",
    documentStatus: "active",
    sharingMode: "private",
    size: input.fileSize ?? null,
    contentType: input.contentType ?? null,
    pageCount: input.pageCount ?? null,
    thumbnailDataUrl: input.thumbnailDataUrl ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(activity).values({
    id: crypto.randomUUID(),
    organizationId,
    action: "document.created",
    actorName: user!.user.name ?? user!.user.email ?? "Unknown",
    targetName: input.name,
    metadata: JSON.stringify({ documentId, publicId }),
    createdAt: now,
  });

  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = rows[0];
  if (!doc) {
    return c.json({ error: "Failed to create document" }, 500);
  }

  return c.json(documentResponse(doc), 201);
});

const listRouteDef = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      filter: z.enum(["all", "owned", "shared"]).optional(),
      workflowStatus: z.string().optional(),
      folderId: z.string().optional(),
      rootOnly: z
        .union([z.literal("true"), z.literal("false")])
        .optional()
        .transform((v) => v === "true"),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(DocumentSchema) },
      },
      description: "List documents",
    },
  },
});

app.openapi(listRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { filter, workflowStatus, folderId, rootOnly } = c.req.valid("query");

  const db = createD1(c.env.D1);

  const conditions: SQL[] = [
    eq(documents.organizationId, organizationId),
    eq(documents.documentStatus, "active"),
  ];

  if (workflowStatus) {
    conditions.push(eq(documents.status, workflowStatus));
  }

  if (folderId) {
    const folderRows = await db
      .select({ id: folders.id })
      .from(folders)
      .where(
        and(
          eq(folders.publicId, folderId),
          eq(folders.organizationId, organizationId)
        )
      )
      .limit(1);
    const folder = folderRows[0];
    if (folder) {
      conditions.push(eq(documents.folderId, folder.id));
    } else {
      return c.json([]);
    }
  } else if (rootOnly) {
    conditions.push(isNull(documents.folderId));
  }

  if (filter === "owned") {
    conditions.push(eq(documents.ownerId, userId));
  } else if (filter === "shared") {
    const accessibleDocIds = await db
      .select({ documentId: documentAccess.documentId })
      .from(documentAccess)
      .where(
        and(eq(documentAccess.userId, userId), isNull(documentAccess.revokedAt))
      );

    if (accessibleDocIds.length === 0) {
      return c.json([]);
    }

    conditions.push(not(eq(documents.ownerId, userId)));
    conditions.push(
      inArray(
        documents.id,
        accessibleDocIds.map((row) => row.documentId)
      )
    );
  }

  const rows = await db
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt));

  return c.json(rows.map(documentResponse));
});

const DocumentStatsSchema = z
  .object({
    total: z.number().int(),
    pending: z.number().int(),
    draft: z.number().int(),
    sent: z.number().int(),
    inProgress: z.number().int(),
    completed: z.number().int(),
    cancelled: z.number().int(),
    declined: z.number().int(),
    expired: z.number().int(),
    completionRate: z.number(),
    createdThisMonth: z.number().int(),
    completedThisMonth: z.number().int(),
  })
  .openapi("DocumentStats");

const statsRouteDef = createRoute({
  method: "get",
  path: "/stats",
  responses: {
    200: {
      content: { "application/json": { schema: DocumentStatsSchema } },
      description: "Document statistics for the active organization",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(statsRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;

  const db = createD1(c.env.D1);

  const countDocuments = async (...conditions: SQL[]) => {
    const result = await db
      .select({ value: count() })
      .from(documents)
      .where(and(eq(documents.organizationId, organizationId), ...conditions));
    return result[0]?.value ?? 0;
  };

  const total = await countDocuments();
  const completed = await countDocuments(eq(documents.status, "completed"));
  const sent = await countDocuments(eq(documents.status, "sent"));
  const inProgress = await countDocuments(eq(documents.status, "in_progress"));
  const cancelled = await countDocuments(eq(documents.status, "cancelled"));
  const declined = await countDocuments(eq(documents.status, "declined"));
  const expired = await countDocuments(eq(documents.status, "expired"));
  const draftCount = await countDocuments(eq(documents.status, "draft"));
  const uploadedCount = await countDocuments(eq(documents.status, "uploaded"));

  const now = new Date();
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

  const createdThisMonth = await countDocuments(
    gte(documents.createdAt, new Date(monthStart))
  );

  const completedThisMonth = await countDocuments(
    eq(documents.status, "completed"),
    gte(documents.updatedAt, new Date(monthStart))
  );

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return c.json({
    total,
    pending: total - completed,
    draft: draftCount + uploadedCount,
    sent,
    inProgress,
    completed,
    cancelled,
    declined,
    expired,
    completionRate,
    createdThisMonth,
    completedThisMonth,
  });
});

const DocumentTrendsSchema = z
  .object({
    date: z.string(),
    created: z.number().int(),
    completed: z.number().int(),
  })
  .openapi("DocumentTrend");

const trendsRouteDef = createRoute({
  method: "get",
  path: "/trends",
  request: {
    query: z.object({
      days: z.coerce.number().int().min(1).max(90).default(30),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(DocumentTrendsSchema) },
      },
      description: "Daily document creation and completion trends",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(trendsRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { days } = c.req.valid("query");

  const db = createD1(c.env.D1);

  const now = new Date();
  const dayRanges: { day: Date; nextDay: Date }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)
    );
    const nextDay = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + 1)
    );
    dayRanges.push({ day, nextDay });
  }

  const createdPromises = dayRanges.map(({ day, nextDay }) =>
    db
      .select({ value: count() })
      .from(documents)
      .where(
        and(
          eq(documents.organizationId, organizationId),
          gte(documents.createdAt, day),
          lt(documents.createdAt, nextDay)
        )
      )
  );

  const completedPromises = dayRanges.map(({ day, nextDay }) =>
    db
      .select({ value: count() })
      .from(documents)
      .where(
        and(
          eq(documents.organizationId, organizationId),
          eq(documents.status, "completed"),
          gte(documents.updatedAt, day),
          lt(documents.updatedAt, nextDay)
        )
      )
  );

  const createdRows = await Promise.all(createdPromises);
  const completedRows = await Promise.all(completedPromises);

  const results = dayRanges.map(({ day }, index) => ({
    date: day.toISOString().slice(0, 10),
    created: createdRows[index]?.[0]?.value ?? 0,
    completed: completedRows[index]?.[0]?.value ?? 0,
  }));

  return c.json(results);
});

const RecentDocumentSchema = z
  .object({
    _id: z.string(),
    name: z.string(),
    updatedAt: z.number(),
    signedCount: z.number().int(),
    recipientCount: z.number().int(),
    status: z.string(),
    thumbnailDataUrl: z.string().nullable().optional(),
  })
  .openapi("RecentDocument");

const recentRouteDef = createRoute({
  method: "get",
  path: "/recent",
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(50).default(5),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(RecentDocumentSchema) },
      },
      description: "Recent documents for the active organization",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(recentRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { limit } = c.req.valid("query");

  const db = createD1(c.env.D1);
  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.organizationId, organizationId))
    .orderBy(desc(documents.createdAt))
    .limit(limit);

  const docIds = docs.map((doc) => doc.id);
  const recipientRows =
    docIds.length > 0
      ? await db
          .select()
          .from(recipients)
          .where(inArray(recipients.documentId, docIds))
      : [];

  const recipientCounts = new Map<string, { total: number; signed: number }>();
  for (const recipient of recipientRows) {
    const existing = recipientCounts.get(recipient.documentId) ?? {
      total: 0,
      signed: 0,
    };
    existing.total += 1;
    if (recipient.status === "signed") {
      existing.signed += 1;
    }
    recipientCounts.set(recipient.documentId, existing);
  }

  const results = docs.map((doc) => {
    const counts = recipientCounts.get(doc.id) ?? { total: 0, signed: 0 };
    return {
      _id: doc.publicId,
      name: doc.name,
      updatedAt: doc.updatedAt.getTime(),
      signedCount: counts.signed,
      recipientCount: counts.total,
      status: doc.status,
      thumbnailDataUrl: null,
    };
  });

  return c.json(results);
});

const DocumentAttentionSchema = z
  .object({
    totalIssues: z.number().int(),
    staleRecipients: z.array(
      z.object({
        documentId: z.string(),
        documentName: z.string(),
        recipientName: z.string(),
        recipientEmail: z.string(),
        daysPending: z.number().int(),
      })
    ),
    approachingDeadline: z.array(
      z.object({
        documentId: z.string(),
        documentName: z.string(),
        deadline: z.number(),
        daysRemaining: z.number().int(),
        unsignedCount: z.number().int(),
      })
    ),
    bouncedEmails: z.array(
      z.object({
        documentId: z.string(),
        documentName: z.string(),
        recipientEmail: z.string(),
      })
    ),
  })
  .openapi("DocumentAttention");

const attentionRouteDef = createRoute({
  method: "get",
  path: "/attention",
  responses: {
    200: {
      content: {
        "application/json": { schema: DocumentAttentionSchema },
      },
      description: "Documents needing attention",
    },
    401: { description: "Unauthorized" },
    403: { description: "No active organization" },
  },
});

app.openapi(attentionRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const db = createD1(c.env.D1);

  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, organizationId),
        inArray(documents.status, ["sent", "in_progress"])
      )
    );

  const docIds = docRows.map((doc) => doc.id);
  const allRecipientRows =
    docIds.length > 0
      ? await db
          .select()
          .from(recipients)
          .where(inArray(recipients.documentId, docIds))
      : [];

  const recipientsByDocument = new Map<string, typeof allRecipientRows>();
  for (const recipient of allRecipientRows) {
    const existing = recipientsByDocument.get(recipient.documentId) ?? [];
    existing.push(recipient);
    recipientsByDocument.set(recipient.documentId, existing);
  }

  const staleRecipients: {
    documentId: string;
    documentName: string;
    recipientName: string;
    recipientEmail: string;
    daysPending: number;
  }[] = [];

  const approachingDeadline: {
    documentId: string;
    documentName: string;
    deadline: number;
    daysRemaining: number;
    unsignedCount: number;
  }[] = [];

  for (const doc of docRows) {
    const recipientRows = recipientsByDocument.get(doc.id) ?? [];
    const sentAt = doc.sentAt?.getTime() ?? doc.createdAt.getTime();

    for (const recipient of recipientRows) {
      if (
        recipient.status === "pending" &&
        !recipient.viewedAt &&
        now - sentAt > threeDaysMs
      ) {
        staleRecipients.push({
          documentId: doc.publicId,
          documentName: doc.name,
          recipientName: recipient.name ?? recipient.email,
          recipientEmail: recipient.email,
          daysPending: Math.floor((now - sentAt) / (1000 * 60 * 60 * 24)),
        });
      }
    }

    if (doc.deadline) {
      const deadlineTime = doc.deadline.getTime();
      const daysRemaining = Math.ceil(
        (deadlineTime - now) / (1000 * 60 * 60 * 24)
      );
      const unsignedCount = recipientRows.filter(
        (r) => r.status === "pending" || r.status === "viewed"
      ).length;

      if (daysRemaining <= 3 && daysRemaining > 0 && unsignedCount > 0) {
        approachingDeadline.push({
          documentId: doc.publicId,
          documentName: doc.name,
          deadline: deadlineTime,
          daysRemaining,
          unsignedCount,
        });
      }
    }
  }

  const result = {
    totalIssues: staleRecipients.length + approachingDeadline.length,
    staleRecipients: staleRecipients.slice(0, 10),
    approachingDeadline: approachingDeadline
      .toSorted((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 10),
    bouncedEmails: [] as {
      documentId: string;
      documentName: string;
      recipientEmail: string;
    }[],
  };

  return c.json(result);
});

const getRouteDef = createRoute({
  method: "get",
  path: "/{publicId}",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: DocumentSchema } },
      description: "Document found",
    },
    404: { description: "Not found" },
  },
});

app.openapi(getRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = rows[0];
  if (!doc) {
    return c.json({ error: "Not found" }, 404);
  }

  return c.json(documentResponse(doc));
});

const updateDocumentBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  redirectUrl: z.string().nullable().optional(),
  allowDictateNextSigner: z.boolean().optional(),
});

const FieldTypeEnum = z.enum([
  "signature",
  "text",
  "number",
  "date",
  "checkbox",
  "dropdown",
  "radio",
  "attachment",
  "payment",
]);

function validateFieldPosition(
  x: number,
  y: number,
  width: number,
  height: number
): { valid: boolean; error?: string } {
  if (x < 0 || x > 100) {
    return { valid: false, error: "X coordinate must be between 0 and 100" };
  }
  if (y < 0 || y > 100) {
    return { valid: false, error: "Y coordinate must be between 0 and 100" };
  }
  if (width <= 0 || width > 100) {
    return { valid: false, error: "Width must be between 0 and 100" };
  }
  if (height <= 0 || height > 100) {
    return { valid: false, error: "Height must be between 0 and 100" };
  }
  if (x + width > 100) {
    return { valid: false, error: "Field extends beyond right page boundary" };
  }
  if (y + height > 100) {
    return { valid: false, error: "Field extends beyond bottom page boundary" };
  }
  return { valid: true };
}

function validatePageNumber(
  page: number,
  pageCount: number | null
): { valid: boolean; error?: string } {
  if (page < 1) {
    return { valid: false, error: "Page number must be at least 1" };
  }
  if (pageCount !== null && page > pageCount) {
    return {
      valid: false,
      error: `Page number exceeds document page count (${pageCount})`,
    };
  }
  return { valid: true };
}

function validateFieldTypeAndProperties(
  fieldType: string,
  properties: z.infer<typeof FieldPropertiesSchema> | null
): { valid: boolean; error?: string } {
  if (fieldType === "payment") {
    return { valid: true };
  }
  if (fieldType === "dropdown" || fieldType === "radio") {
    if (!properties?.options || properties.options.length === 0) {
      return {
        valid: false,
        error: `${fieldType} fields must have at least one option`,
      };
    }
  }
  if (
    properties?.maxLength !== undefined &&
    properties?.minLength !== undefined &&
    properties.maxLength < properties.minLength
  ) {
    return { valid: false, error: "maxLength must be greater than minLength" };
  }
  return { valid: true };
}

const updateRouteDef = createRoute({
  method: "patch",
  path: "/{publicId}",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateDocumentBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: DocumentSchema } },
      description: "Document updated",
    },
    400: { description: "Invalid redirect URL or immutable document" },
    403: { description: "Forbidden" },
    404: { description: "Document not found" },
  },
});

app.openapi(updateRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");
  const input = c.req.valid("json");

  const db = createD1(c.env.D1);
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = rows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (doc.status === "completed") {
    return c.json(
      {
        error:
          "Completed documents cannot be modified. They are immutable for legal compliance.",
      },
      400
    );
  }

  if (!(await hasEditDocumentAccess(db, doc, userId))) {
    return c.json({ error: "You don't have permission to edit this document" }, 403);
  }

  try {
    validateRedirectUrl(input.redirectUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid redirect URL";
    return c.json({ error: message }, 400);
  }

  const updateData: {
    name?: string;
    description?: string | null;
    redirectUrl?: string | null;
    allowDictateNextSigner?: boolean;
    updatedAt?: Date;
  } = { updatedAt: new Date() };

  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.description !== undefined) {
    updateData.description = input.description;
  }
  if (input.redirectUrl !== undefined) {
    updateData.redirectUrl = input.redirectUrl;
  }
  if (input.allowDictateNextSigner !== undefined) {
    updateData.allowDictateNextSigner = input.allowDictateNextSigner;
  }

  await db
    .update(documents)
    .set(updateData)
    .where(eq(documents.id, doc.id));

  const updated = await db
    .select()
    .from(documents)
    .where(eq(documents.id, doc.id))
    .limit(1);

  const updatedDoc = updated[0];
  if (!updatedDoc) {
    return c.json({ error: "Failed to update document" }, 500);
  }

  return c.json(documentResponse(updatedDoc));
});

const uploadBodySchema = z.object({
  contentBase64: z.string().min(1),
  contentType: z.string().optional(),
});

const uploadRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/upload",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: uploadBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: FileSchema } },
      description: "Document uploaded",
    },
    404: { description: "Document not found" },
    503: { description: "Object storage not configured" },
  },
});

app.openapi(uploadRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");
  const input = c.req.valid("json");

  const bucket = c.env.DOCUMENTS_BUCKET;
  if (!bucket) {
    return c.json({ error: "Object storage not configured" }, 503);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = rows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const bytes = base64ToBytes(input.contentBase64);
  const contentType = input.contentType || "application/octet-stream";
  const key = r2Key(organizationId, publicId);

  await bucket.put(key, bytes, { httpMetadata: { contentType } });

  await db
    .update(documents)
    .set({
      storageKey: key,
      contentType,
      size: bytes.length,
      status: "uploaded",
    })
    .where(eq(documents.id, doc.id));

  return c.json({ storageKey: key, contentType, size: bytes.length });
});

const downloadRouteDef = createRoute({
  method: "get",
  path: "/{publicId}/download",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: { description: "Document file" },
    404: { description: "Document or file not found" },
    503: { description: "Object storage not configured" },
  },
});

app.openapi(downloadRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");

  const bucket = c.env.DOCUMENTS_BUCKET;
  if (!bucket) {
    return c.json({ error: "Object storage not configured" }, 503);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = rows[0];
  if (!doc || !doc.storageKey) {
    return c.json({ error: "Document or file not found" }, 404);
  }

  const object = await bucket.get(doc.storageKey);
  if (!object || !object.body) {
    return c.json({ error: "Document or file not found" }, 404);
  }

  const headers: Record<string, string> = {
    "content-type":
      object.httpMetadata?.contentType || "application/octet-stream",
  };
  if (object.size) headers["content-length"] = String(object.size);

  return c.body(object.body, { headers });
});

const RecipientSchema = z
  .object({
    id: z.string(),
    publicId: z.string(),
    documentId: z.string(),
    name: z.string().nullable().optional(),
    email: z.string(),
    role: z.string(),
    order: z.number().int(),
    status: z.string(),
    signingToken: z.string().nullable().optional(),
    tokenExpiresAt: z.number().nullable().optional(),
    viewedAt: z.number().nullable().optional(),
    signedAt: z.number().nullable().optional(),
    approvedAt: z.number().nullable().optional(),
    declinedAt: z.number().nullable().optional(),
    signatureData: z.string().nullable().optional(),
    signatureType: z.string().nullable().optional(),
    authenticationData: z.string().nullable().optional(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("Recipient");

const recipientResponse = (recipient: {
  id: string;
  publicId: string;
  documentId: string;
  name: string | null;
  email: string;
  role: string;
  order: number;
  status: string;
  signingToken: string | null;
  tokenExpiresAt: Date | null;
  viewedAt: Date | null;
  signedAt: Date | null;
  approvedAt: Date | null;
  declinedAt: Date | null;
  signatureData: string | null;
  signatureType: string | null;
  authenticationData: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: recipient.id,
  publicId: recipient.publicId,
  documentId: recipient.documentId,
  name: recipient.name,
  email: recipient.email,
  role: recipient.role,
  order: recipient.order,
  status: recipient.status,
  signingToken: recipient.signingToken,
  tokenExpiresAt: recipient.tokenExpiresAt
    ? recipient.tokenExpiresAt.getTime()
    : null,
  viewedAt: recipient.viewedAt ? recipient.viewedAt.getTime() : null,
  signedAt: recipient.signedAt ? recipient.signedAt.getTime() : null,
  approvedAt: recipient.approvedAt ? recipient.approvedAt.getTime() : null,
  declinedAt: recipient.declinedAt ? recipient.declinedAt.getTime() : null,
  signatureData: recipient.signatureData,
  signatureType: recipient.signatureType,
  authenticationData: recipient.authenticationData,
  createdAt: recipient.createdAt.getTime(),
  updatedAt: recipient.updatedAt.getTime(),
});

const addRecipientsBodySchema = z.object({
  recipients: z.array(
    z.object({
      email: z.string().email(),
      name: z.string().optional(),
      role: z.enum(["signer", "viewer", "approver"]).optional(),
      order: z.number().int().optional(),
      isPlaceholder: z.boolean().optional(),
    })
  ),
});

const addRecipientsRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/recipients",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: addRecipientsBodySchema },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: z.array(RecipientSchema) } },
      description: "Recipients added",
    },
    400: { description: "Invalid request" },
    403: { description: "Forbidden" },
    404: { description: "Document not found" },
  },
});

app.openapi(addRecipientsRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");
  const input = c.req.valid("json");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (doc.ownerId !== userId) {
    return c.json({ error: "Only the document owner can add recipients" }, 403);
  }

  if (doc.status === "deleted" || doc.documentStatus !== "active") {
    return c.json({ error: "Cannot add recipients to this document" }, 400);
  }

  if (input.recipients.length === 0) {
    return c.json({ error: "At least one recipient is required" }, 400);
  }

  const emails = input.recipients.map((r) => r.email.toLowerCase());
  const uniqueEmails = new Set(emails);
  if (emails.length !== uniqueEmails.size) {
    return c.json({ error: "Duplicate recipient emails are not allowed" }, 400);
  }

  const countResult = await db
    .select({ value: count() })
    .from(recipients)
    .where(eq(recipients.documentId, doc.id));

  const now = new Date();
  const baseOrder = countResult[0]?.value ?? 0;
  const tokenExpiration = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const recipientValues = input.recipients.map((recipientInput, index) => ({
    id: crypto.randomUUID(),
    publicId: crypto.randomUUID(),
    documentId: doc.id,
    name: recipientInput.name ?? null,
    email: recipientInput.email.toLowerCase(),
    role: recipientInput.role ?? "signer",
    order: recipientInput.order ?? baseOrder + index + 1,
    status: "pending" as const,
    signingToken: generateSigningToken(),
    tokenExpiresAt: tokenExpiration,
    createdAt: now,
    updatedAt: now,
  }));

  await db.insert(recipients).values(recipientValues);

  const insertedIds = recipientValues.map((r) => r.id);
  const rows = await db
    .select()
    .from(recipients)
    .where(and(eq(recipients.documentId, doc.id), inArray(recipients.id, insertedIds)))
    .orderBy(asc(recipients.order), asc(recipients.createdAt));

  await db.insert(activity).values({
    id: crypto.randomUUID(),
    organizationId,
    action: "recipients.added",
    actorName: user!.user.name ?? user!.user.email ?? "Unknown",
    targetName: doc.name,
    metadata: JSON.stringify({
      documentId: doc.id,
      publicId,
      count: rows.length,
    }),
    createdAt: now,
  });

  return c.json(rows.map(recipientResponse), 201);
});

const listRecipientsRouteDef = createRoute({
  method: "get",
  path: "/{publicId}/recipients",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(RecipientSchema) },
      },
      description: "Recipients for the document",
    },
    404: { description: "Document not found" },
  },
});

app.openapi(listRecipientsRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const rows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.documentId, doc.id))
    .orderBy(asc(recipients.order), asc(recipients.createdAt));

  return c.json(rows.map(recipientResponse));
});

const removeRecipientRouteDef = createRoute({
  method: "delete",
  path: "/{publicId}/recipients/{recipientPublicId}",
  request: {
    params: z.object({
      publicId: z.string(),
      recipientPublicId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Recipient removed",
    },
    400: { description: "Cannot remove recipient" },
    403: { description: "Forbidden" },
    404: { description: "Document or recipient not found" },
  },
});

app.openapi(removeRecipientRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId, recipientPublicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (doc.ownerId !== userId) {
    return c.json({ error: "Only the document owner can remove recipients" }, 403);
  }

  if (doc.status === "deleted") {
    return c.json({ error: "Cannot remove recipients from a deleted document" }, 400);
  }

  const recipientRows = await db
    .select()
    .from(recipients)
    .where(
      and(
        eq(recipients.publicId, recipientPublicId),
        eq(recipients.documentId, doc.id)
      )
    )
    .limit(1);

  const recipient = recipientRows[0];
  if (!recipient) {
    return c.json({ error: "Recipient not found" }, 404);
  }

  await db
    .delete(signatureFields)
    .where(eq(signatureFields.recipientId, recipient.id));

  await db.delete(recipients).where(eq(recipients.id, recipient.id));

  return c.json({ success: true });
});

const resendRecipientBodySchema = z.object({
  customMessage: z.string().optional(),
});

const resendRecipientRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/recipients/{recipientPublicId}/resend",
  request: {
    params: z.object({
      publicId: z.string(),
      recipientPublicId: z.string(),
    }),
    body: {
      content: {
        "application/json": { schema: resendRecipientBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Recipient email resent",
    },
    400: { description: "Cannot resend email" },
    403: { description: "Forbidden" },
    404: { description: "Document or recipient not found" },
  },
});

app.openapi(resendRecipientRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId, recipientPublicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (doc.ownerId !== userId) {
    return c.json({ error: "Only the document owner can resend emails" }, 403);
  }

  if (doc.status === "draft") {
    return c.json(
      { error: "Cannot resend email - document has not been sent yet" },
      400
    );
  }

  const recipientRows = await db
    .select()
    .from(recipients)
    .where(
      and(
        eq(recipients.publicId, recipientPublicId),
        eq(recipients.documentId, doc.id)
      )
    )
    .limit(1);

  const recipient = recipientRows[0];
  if (!recipient) {
    return c.json({ error: "Recipient not found" }, 404);
  }

  if (recipient.status === "signed" || recipient.status === "approved") {
    return c.json(
      { error: `Cannot resend - recipient has already ${recipient.status}` },
      400
    );
  }

  const now = new Date();
  const newToken = generateSigningToken();
  const newExpiration = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db
    .update(recipients)
    .set({
      signingToken: newToken,
      tokenExpiresAt: newExpiration,
      updatedAt: now,
    })
    .where(eq(recipients.id, recipient.id));

  await db.insert(activity).values({
    id: crypto.randomUUID(),
    organizationId,
    action: "recipient.resend",
    actorName: user!.user.name ?? user!.user.email ?? "Unknown",
    targetName: doc.name,
    metadata: JSON.stringify({
      documentId: doc.id,
      publicId,
      recipientId: recipient.id,
    }),
    createdAt: now,
  });

  return c.json({ success: true });
});

const FieldPropertiesSchema = z
  .object({
    placeholder: z.string().optional(),
    defaultValue: z.string().optional(),
    options: z.array(z.string()).optional(),
    maxLength: z.number().optional(),
    minLength: z.number().optional(),
    pattern: z.string().optional(),
    helpText: z.string().optional(),
  })
  .partial()
  .passthrough()
  .nullable();

const FieldValidationRulesSchema = z
  .object({
    required: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    customMessage: z.string().optional(),
  })
  .partial()
  .passthrough()
  .nullable();

const SignatureFieldSchema = z
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
    properties: FieldPropertiesSchema,
    validationRules: FieldValidationRulesSchema,
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .openapi("SignatureField");

function signatureFieldResponse(field: {
  id: string;
  publicId: string;
  documentId: string;
  recipientId: string | null;
  templateFieldId: string | null;
  fieldType: string;
  label: string;
  isRequired: boolean;
  isMainSignature: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  properties: string | null;
  validationRules: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
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
    properties: field.properties
      ? FieldPropertiesSchema.parse(JSON.parse(field.properties))
      : null,
    validationRules: field.validationRules
      ? FieldValidationRulesSchema.parse(JSON.parse(field.validationRules))
      : null,
    createdAt: field.createdAt.getTime(),
    updatedAt: field.updatedAt.getTime(),
  };
}

const SignatureFieldWithValuesSchema = SignatureFieldSchema.extend({
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
}).openapi("SignatureFieldWithValues");

function signatureFieldWithValuesResponse(
  field: {
    id: string;
    publicId: string;
    documentId: string;
    recipientId: string | null;
    templateFieldId: string | null;
    fieldType: string;
    label: string;
    isRequired: boolean;
    isMainSignature: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    page: number;
    properties: string | null;
    validationRules: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  signature: {
    value: string | null;
    signatureImageUrl: string | null;
    signatureMethod: string | null;
    signedAt: Date;
    signerName: string | null;
    signerEmail: string | null;
  } | null,
  isFilled: boolean
) {
  const base = signatureFieldResponse(field);
  return {
    ...base,
    currentValue: signature?.value,
    currentSignatureImageUrl: signature?.signatureImageUrl,
    isFilled,
    signatureDetails: signature
      ? {
          signedAt: signature.signedAt.getTime(),
          signerName: signature.signerName,
          signerEmail: signature.signerEmail,
          signatureMethod: signature.signatureMethod,
        }
      : undefined,
  };
}

const listSignatureFieldsRouteDef = createRoute({
  method: "get",
  path: "/{publicId}/signature-fields",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(SignatureFieldSchema) },
      },
      description: "Signature fields for the document",
    },
    404: { description: "Document not found" },
  },
});

app.openapi(listSignatureFieldsRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const rows = await db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.documentId, doc.id))
    .orderBy(asc(signatureFields.page), asc(signatureFields.createdAt));

  return c.json(rows.map(signatureFieldResponse));
});

const getSignatureFieldsForMeRouteDef = createRoute({
  method: "get",
  path: "/{publicId}/signature-fields/me",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(SignatureFieldWithValuesSchema) },
      },
      description: "Signature fields assigned to the current user",
    },
    404: { description: "Document not found" },
  },
});

app.openapi(getSignatureFieldsForMeRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userEmail = user!.user.email?.toLowerCase();
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc || !userEmail) {
    return c.json([]);
  }

  const recipientRows = await db
    .select()
    .from(recipients)
    .where(
      and(eq(recipients.documentId, doc.id), eq(recipients.email, userEmail))
    )
    .limit(1);

  const recipient = recipientRows[0];
  if (!recipient) {
    return c.json([]);
  }

  const fields = await db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.recipientId, recipient.id))
    .orderBy(asc(signatureFields.page), asc(signatureFields.createdAt));

  const signaturePromises = fields.map((field) =>
    db
      .select({
        value: signatures.value,
        signatureImageUrl: signatures.signatureImageUrl,
        signatureMethod: signatures.signatureMethod,
        signedAt: signatures.signedAt,
        signerName: recipients.name,
        signerEmail: recipients.email,
      })
      .from(signatures)
      .leftJoin(recipients, eq(recipients.id, signatures.recipientId))
      .where(
        and(
          eq(signatures.fieldId, field.id),
          eq(signatures.documentId, doc.id)
        )
      )
      .limit(1)
  );

  const signaturesByField = new Map<
    string,
    {
      value: string | null;
      signatureImageUrl: string | null;
      signatureMethod: string | null;
      signedAt: Date;
      signerName: string | null;
      signerEmail: string | null;
    }
  >();

  const signatureResults = await Promise.all(signaturePromises);
  for (const [index, field] of fields.entries()) {
    const result = signatureResults[index];
    const signature = result?.[0];
    if (signature) {
      signaturesByField.set(field.id, {
        value: signature.value,
        signatureImageUrl: signature.signatureImageUrl,
        signatureMethod: signature.signatureMethod,
        signedAt: signature.signedAt,
        signerName: signature.signerName,
        signerEmail: signature.signerEmail,
      });
    }
  }

  const paymentFieldIds = fields
    .filter((field) => field.fieldType === "payment")
    .map((field) => field.id);

  const paymentConfigs = paymentFieldIds.length
    ? await db
        .select({
          fieldId: paymentFieldConfigs.fieldId,
          paymentStatus: paymentFieldConfigs.paymentStatus,
        })
        .from(paymentFieldConfigs)
        .where(inArray(paymentFieldConfigs.fieldId, paymentFieldIds))
    : [];

  const paidFieldIds = new Set(
    paymentConfigs
      .filter((config) => config.paymentStatus === "paid")
      .map((config) => config.fieldId)
  );

  return c.json(
    fields.map((field) => {
      const signature = signaturesByField.get(field.id) ?? null;
      const isFilled =
        signature !== null ||
        (field.fieldType === "payment" && paidFieldIds.has(field.id));
      return signatureFieldWithValuesResponse(field, signature, isFilled);
    })
  );
});

const createSignatureFieldBodySchema = z.object({
  recipientPublicId: z.string().optional(),
  fieldType: FieldTypeEnum,
  label: z.string().min(1),
  isRequired: z.boolean(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  page: z.number().int(),
  properties: FieldPropertiesSchema.optional(),
  validationRules: FieldValidationRulesSchema.optional(),
  templateFieldId: z.string().optional(),
});

const createSignatureFieldRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/signature-fields",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: createSignatureFieldBodySchema },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": { schema: SignatureFieldSchema },
      },
      description: "Signature field created",
    },
    400: { description: "Invalid field data or document not editable" },
    403: { description: "Forbidden" },
    404: { description: "Document or recipient not found" },
  },
});

app.openapi(createSignatureFieldRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");
  const input = c.req.valid("json");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (doc.ownerId !== userId) {
    return c.json({ error: "Only the document owner can edit fields" }, 403);
  }

  if (doc.status !== "draft") {
    return c.json({ error: "Fields can only be modified in draft status" }, 400);
  }

  const positionValidation = validateFieldPosition(
    input.x,
    input.y,
    input.width,
    input.height
  );
  if (!positionValidation.valid) {
    return c.json({ error: positionValidation.error }, 400);
  }

  const pageValidation = validatePageNumber(input.page, doc.pageCount);
  if (!pageValidation.valid) {
    return c.json({ error: pageValidation.error }, 400);
  }

  const typeValidation = validateFieldTypeAndProperties(
    input.fieldType,
    input.properties ?? null
  );
  if (!typeValidation.valid) {
    return c.json({ error: typeValidation.error }, 400);
  }

  let recipientId: string | null = null;
  if (input.recipientPublicId) {
    const recipientRows = await db
      .select()
      .from(recipients)
      .where(
        and(
          eq(recipients.publicId, input.recipientPublicId),
          eq(recipients.documentId, doc.id)
        )
      )
      .limit(1);

    const recipient = recipientRows[0];
    if (!recipient) {
      return c.json({ error: "Recipient not found" }, 404);
    }
    recipientId = recipient.id;

    if (input.fieldType === "payment") {
      const existingPayment = await db
        .select({ value: count() })
        .from(signatureFields)
        .where(
          and(
            eq(signatureFields.documentId, doc.id),
            eq(signatureFields.recipientId, recipientId),
            eq(signatureFields.fieldType, "payment")
          )
        );
      if ((existingPayment[0]?.value ?? 0) > 0) {
        return c.json(
          { error: "Each recipient can only have one payment field" },
          400
        );
      }
    }
  }

  let isMainSignature = false;
  if (input.fieldType === "signature" && recipientId) {
    const existingSignatures = await db
      .select({ value: count() })
      .from(signatureFields)
      .where(
        and(
          eq(signatureFields.documentId, doc.id),
          eq(signatureFields.recipientId, recipientId),
          eq(signatureFields.fieldType, "signature")
        )
      );
    isMainSignature = (existingSignatures[0]?.value ?? 0) === 0;
  }

  const fieldId = crypto.randomUUID();
  const fieldPublicId = crypto.randomUUID();
  const now = new Date();
  const propertiesJson = input.properties
    ? JSON.stringify(input.properties)
    : null;
  const validationJson = input.validationRules
    ? JSON.stringify(input.validationRules)
    : null;

  await db.insert(signatureFields).values({
    id: fieldId,
    publicId: fieldPublicId,
    documentId: doc.id,
    recipientId,
    templateFieldId: input.templateFieldId ?? null,
    fieldType: input.fieldType,
    label: input.label,
    isRequired: input.isRequired,
    isMainSignature,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    page: input.page,
    properties: propertiesJson,
    validationRules: validationJson,
    createdAt: now,
    updatedAt: now,
  });

  const rows = await db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.id, fieldId))
    .limit(1);

  const field = rows[0];
  if (!field) {
    return c.json({ error: "Failed to create field" }, 500);
  }

  return c.json(signatureFieldResponse(field), 201);
});

const updateSignatureFieldBodySchema = z.object({
  label: z.string().min(1).optional(),
  isRequired: z.boolean().optional(),
  properties: FieldPropertiesSchema.optional(),
  validationRules: FieldValidationRulesSchema.optional(),
});

const updateSignatureFieldRouteDef = createRoute({
  method: "patch",
  path: "/{publicId}/signature-fields/{fieldPublicId}",
  request: {
    params: z.object({ publicId: z.string(), fieldPublicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateSignatureFieldBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: SignatureFieldSchema } },
      description: "Signature field updated",
    },
    400: { description: "Invalid field data or document not editable" },
    403: { description: "Forbidden" },
    404: { description: "Document or field not found" },
  },
});

app.openapi(updateSignatureFieldRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId, fieldPublicId } = c.req.valid("param");
  const input = c.req.valid("json");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (doc.ownerId !== userId) {
    return c.json({ error: "Only the document owner can edit fields" }, 403);
  }

  if (doc.status !== "draft") {
    return c.json({ error: "Fields can only be modified in draft status" }, 400);
  }

  const fieldRows = await db
    .select()
    .from(signatureFields)
    .where(
      and(
        eq(signatureFields.publicId, fieldPublicId),
        eq(signatureFields.documentId, doc.id)
      )
    )
    .limit(1);

  const field = fieldRows[0];
  if (!field) {
    return c.json({ error: "Field not found" }, 404);
  }

  if (input.properties) {
    const parsedProperties =
      field.properties !== null ? JSON.parse(field.properties) : null;
    const mergedProperties = { ...parsedProperties, ...input.properties };
    const typeValidation = validateFieldTypeAndProperties(
      field.fieldType,
      mergedProperties
    );
    if (!typeValidation.valid) {
      return c.json({ error: typeValidation.error }, 400);
    }
  }

  const updateData: {
    label?: string;
    isRequired?: boolean;
    properties?: string | null;
    validationRules?: string | null;
    updatedAt?: Date;
  } = { updatedAt: new Date() };

  if (input.label !== undefined) {
    updateData.label = input.label;
  }
  if (input.isRequired !== undefined) {
    updateData.isRequired = input.isRequired;
  }
  if (input.properties !== undefined) {
    updateData.properties = JSON.stringify(input.properties);
  }
  if (input.validationRules !== undefined) {
    updateData.validationRules = JSON.stringify(input.validationRules);
  }

  await db
    .update(signatureFields)
    .set(updateData)
    .where(eq(signatureFields.id, field.id));

  const updatedRows = await db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.id, field.id))
    .limit(1);

  const updatedField = updatedRows[0];
  if (!updatedField) {
    return c.json({ error: "Failed to update field" }, 500);
  }

  return c.json(signatureFieldResponse(updatedField));
});

const repositionSignatureFieldBodySchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  page: z.number().int().optional(),
});

const repositionSignatureFieldRouteDef = createRoute({
  method: "patch",
  path: "/{publicId}/signature-fields/{fieldPublicId}/position",
  request: {
    params: z.object({ publicId: z.string(), fieldPublicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: repositionSignatureFieldBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: SignatureFieldSchema } },
      description: "Signature field repositioned",
    },
    400: { description: "Invalid position or document not editable" },
    403: { description: "Forbidden" },
    404: { description: "Document or field not found" },
  },
});

app.openapi(repositionSignatureFieldRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId, fieldPublicId } = c.req.valid("param");
  const input = c.req.valid("json");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (doc.ownerId !== userId) {
    return c.json({ error: "Only the document owner can edit fields" }, 403);
  }

  if (doc.status !== "draft") {
    return c.json({ error: "Fields can only be modified in draft status" }, 400);
  }

  const fieldRows = await db
    .select()
    .from(signatureFields)
    .where(
      and(
        eq(signatureFields.publicId, fieldPublicId),
        eq(signatureFields.documentId, doc.id)
      )
    )
    .limit(1);

  const field = fieldRows[0];
  if (!field) {
    return c.json({ error: "Field not found" }, 404);
  }

  const newX = input.x ?? field.x;
  const newY = input.y ?? field.y;
  const newWidth = input.width ?? field.width;
  const newHeight = input.height ?? field.height;
  const newPage = input.page ?? field.page;

  const positionValidation = validateFieldPosition(
    newX,
    newY,
    newWidth,
    newHeight
  );
  if (!positionValidation.valid) {
    return c.json({ error: positionValidation.error }, 400);
  }

  const pageValidation = validatePageNumber(newPage, doc.pageCount);
  if (!pageValidation.valid) {
    return c.json({ error: pageValidation.error }, 400);
  }

  await db
    .update(signatureFields)
    .set({
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
      page: newPage,
      updatedAt: new Date(),
    })
    .where(eq(signatureFields.id, field.id));

  const updatedRows = await db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.id, field.id))
    .limit(1);

  const updatedField = updatedRows[0];
  if (!updatedField) {
    return c.json({ error: "Failed to reposition field" }, 500);
  }

  return c.json(signatureFieldResponse(updatedField));
});

const assignSignatureFieldBodySchema = z.object({
  recipientPublicId: z.string(),
});

const assignSignatureFieldRouteDef = createRoute({
  method: "patch",
  path: "/{publicId}/signature-fields/{fieldPublicId}/assign",
  request: {
    params: z.object({ publicId: z.string(), fieldPublicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: assignSignatureFieldBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: SignatureFieldSchema } },
      description: "Signature field assigned",
    },
    400: { description: "Invalid recipient or document not editable" },
    403: { description: "Forbidden" },
    404: { description: "Document, field, or recipient not found" },
  },
});

app.openapi(assignSignatureFieldRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId, fieldPublicId } = c.req.valid("param");
  const input = c.req.valid("json");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (doc.ownerId !== userId) {
    return c.json({ error: "Only the document owner can edit fields" }, 403);
  }

  if (doc.status !== "draft") {
    return c.json({ error: "Fields can only be modified in draft status" }, 400);
  }

  const fieldRows = await db
    .select()
    .from(signatureFields)
    .where(
      and(
        eq(signatureFields.publicId, fieldPublicId),
        eq(signatureFields.documentId, doc.id)
      )
    )
    .limit(1);

  const field = fieldRows[0];
  if (!field) {
    return c.json({ error: "Field not found" }, 404);
  }

  const recipientRows = await db
    .select()
    .from(recipients)
    .where(
      and(
        eq(recipients.publicId, input.recipientPublicId),
        eq(recipients.documentId, doc.id)
      )
    )
    .limit(1);

  const recipient = recipientRows[0];
  if (!recipient) {
    return c.json({ error: "Recipient not found" }, 404);
  }

  let isMainSignature = field.isMainSignature;
  if (
    field.fieldType === "signature" &&
    recipient.id !== field.recipientId
  ) {
    const existingMain = await db
      .select({ value: count() })
      .from(signatureFields)
      .where(
        and(
          eq(signatureFields.documentId, doc.id),
          eq(signatureFields.recipientId, recipient.id),
          eq(signatureFields.fieldType, "signature"),
          eq(signatureFields.isMainSignature, true)
        )
      );
    isMainSignature = (existingMain[0]?.value ?? 0) === 0;
  }

  await db
    .update(signatureFields)
    .set({
      recipientId: recipient.id,
      isMainSignature,
      updatedAt: new Date(),
    })
    .where(eq(signatureFields.id, field.id));

  const updatedRows = await db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.id, field.id))
    .limit(1);

  const updatedField = updatedRows[0];
  if (!updatedField) {
    return c.json({ error: "Failed to assign field" }, 500);
  }

  return c.json(signatureFieldResponse(updatedField));
});

const deleteSignatureFieldRouteDef = createRoute({
  method: "delete",
  path: "/{publicId}/signature-fields/{fieldPublicId}",
  request: {
    params: z.object({ publicId: z.string(), fieldPublicId: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
      description: "Signature field deleted",
    },
    400: { description: "Cannot delete field or document not editable" },
    403: { description: "Forbidden" },
    404: { description: "Document or field not found" },
  },
});

app.openapi(deleteSignatureFieldRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId, fieldPublicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  if (doc.ownerId !== userId) {
    return c.json({ error: "Only the document owner can edit fields" }, 403);
  }

  if (doc.status !== "draft") {
    return c.json({ error: "Fields can only be modified in draft status" }, 400);
  }

  const fieldRows = await db
    .select()
    .from(signatureFields)
    .where(
      and(
        eq(signatureFields.publicId, fieldPublicId),
        eq(signatureFields.documentId, doc.id)
      )
    )
    .limit(1);

  const field = fieldRows[0];
  if (!field) {
    return c.json({ error: "Field not found" }, 404);
  }

  const existingSignatures = await db
    .select({ value: count() })
    .from(signatures)
    .where(eq(signatures.fieldId, field.id));

  if ((existingSignatures[0]?.value ?? 0) > 0) {
    return c.json({ error: "Cannot delete field that has been signed" }, 400);
  }

  await db.delete(signatureFields).where(eq(signatureFields.id, field.id));

  return c.json({ success: true });
});

const PaymentConfigSummarySchema = z
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
  .openapi("PaymentConfigSummary");

function paymentConfigSummaryResponse(config: {
  id: string;
  publicId: string;
  fieldId: string;
  documentId: string;
  paymentType: string;
  totalAmountCents: number;
  currency: string;
  paymentStatus: string | null;
}) {
  return {
    id: config.id,
    publicId: config.publicId,
    fieldId: config.fieldId,
    documentId: config.documentId,
    paymentType: config.paymentType,
    totalAmountCents: config.totalAmountCents,
    currency: config.currency,
    paymentStatus: config.paymentStatus,
  };
}

const listPaymentConfigsRouteDef = createRoute({
  method: "get",
  path: "/{publicId}/payment-configs",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(PaymentConfigSummarySchema) },
      },
      description: "Payment configs for the document",
    },
    404: { description: "Document not found" },
  },
});

app.openapi(listPaymentConfigsRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
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

  return c.json(rows.map(paymentConfigSummaryResponse));
});

type RecipientStatus =
  | "pending"
  | "viewed"
  | "signed"
  | "approved"
  | "declined"
  | "expired";
type RecipientRole = "signer" | "viewer" | "approver";

const recipientStatusSet = new Set<string>([
  "pending",
  "viewed",
  "signed",
  "approved",
  "declined",
  "expired",
]);
const recipientRoleSet = new Set<string>(["signer", "viewer", "approver"]);

function isRecipientStatus(status: string): status is RecipientStatus {
  return recipientStatusSet.has(status);
}

function isRecipientRole(role: string): role is RecipientRole {
  return recipientRoleSet.has(role);
}

function isRecipientComplete(role: string, status: string): boolean {
  switch (role) {
    case "signer":
      return status === "signed";
    case "approver":
      return status === "approved";
    case "viewer":
      return status === "viewed";
    default:
      return false;
  }
}

const RecipientProgressSchema = z
  .object({
    total: z.number().int(),
    completed: z.number().int(),
    percentComplete: z.number().int(),
    byStatus: z.object({
      pending: z.number().int(),
      viewed: z.number().int(),
      signed: z.number().int(),
      approved: z.number().int(),
      declined: z.number().int(),
      expired: z.number().int(),
    }),
    byRole: z.object({
      signer: z.object({ total: z.number().int(), completed: z.number().int() }),
      viewer: z.object({ total: z.number().int(), completed: z.number().int() }),
      approver: z.object({ total: z.number().int(), completed: z.number().int() }),
    }),
  })
  .openapi("RecipientProgress");

const recipientProgressRouteDef = createRoute({
  method: "get",
  path: "/{publicId}/recipients/progress",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: RecipientProgressSchema },
      },
      description: "Recipient progress for the document",
    },
    404: { description: "Document not found" },
  },
});

app.openapi(recipientProgressRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const rows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.documentId, doc.id));

  if (rows.length === 0) {
    return c.json({
      total: 0,
      completed: 0,
      percentComplete: 0,
      byStatus: {
        pending: 0,
        viewed: 0,
        signed: 0,
        approved: 0,
        declined: 0,
        expired: 0,
      },
      byRole: {
        signer: { total: 0, completed: 0 },
        viewer: { total: 0, completed: 0 },
        approver: { total: 0, completed: 0 },
      },
    });
  }

  const byStatus = {
    pending: 0,
    viewed: 0,
    signed: 0,
    approved: 0,
    declined: 0,
    expired: 0,
  };
  const byRole = {
    signer: { total: 0, completed: 0 },
    viewer: { total: 0, completed: 0 },
    approver: { total: 0, completed: 0 },
  };

  let completed = 0;
  for (const recipient of rows) {
    if (isRecipientStatus(recipient.status)) {
      byStatus[recipient.status]++;
    }
    if (isRecipientRole(recipient.role)) {
      byRole[recipient.role].total++;
      if (isRecipientComplete(recipient.role, recipient.status)) {
        completed++;
        byRole[recipient.role].completed++;
      }
    }
  }

  const percentComplete = Math.round((completed / rows.length) * 100);

  return c.json({
    total: rows.length,
    completed,
    percentComplete,
    byStatus,
    byRole,
  });
});

const recipientByMeRouteDef = createRoute({
  method: "get",
  path: "/{publicId}/recipients/me",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: RecipientSchema.nullable() } },
      description: "Current user's recipient record for the document",
    },
    404: { description: "Document not found" },
  },
});

app.openapi(recipientByMeRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userEmail = user!.user.email?.toLowerCase();
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc || !userEmail) {
    return c.json(null);
  }

  const rows = await db
    .select()
    .from(recipients)
    .where(
      and(
        eq(recipients.documentId, doc.id),
        eq(recipients.email, userEmail)
      )
    )
    .limit(1);

  const recipient = rows[0];
  if (!recipient) {
    return c.json(null);
  }

  return c.json(recipientResponse(recipient));
});

const SignatureSchema = z
  .object({
    id: z.string(),
    fieldId: z.string().nullable().optional(),
    recipientId: z.string(),
    documentId: z.string(),
    signedAt: z.number(),
    ipAddress: z.string().nullable().optional(),
    userAgent: z.string().nullable().optional(),
    value: z.string().nullable().optional(),
    signatureImageUrl: z.string().nullable().optional(),
    signatureMethod: z.string().nullable().optional(),
    signatureHash: z.string().nullable().optional(),
    signatureImageHash: z.string().nullable().optional(),
    documentHashAtSigning: z.string().nullable().optional(),
    authenticationData: z.string().nullable().optional(),
  })
  .openapi("Signature");

const signBodySchema = z.object({
  fieldId: z.string().optional(),
  value: z.string().optional(),
  signatureImageUrl: z.string().optional(),
  signatureMethod: z.string().optional(),
  signatureHash: z.string().optional(),
  signatureImageHash: z.string().optional(),
  documentHashAtSigning: z.string().optional(),
  userAgent: z.string().optional(),
});

function signatureResponse(signature: {
  id: string;
  fieldId: string | null;
  recipientId: string;
  documentId: string;
  signedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  value: string | null;
  signatureImageUrl: string | null;
  signatureMethod: string | null;
  signatureHash: string | null;
  signatureImageHash: string | null;
  documentHashAtSigning: string | null;
  authenticationData: string | null;
}) {
  return {
    id: signature.id,
    fieldId: signature.fieldId,
    recipientId: signature.recipientId,
    documentId: signature.documentId,
    signedAt: signature.signedAt.getTime(),
    ipAddress: signature.ipAddress,
    userAgent: signature.userAgent,
    value: signature.value,
    signatureImageUrl: signature.signatureImageUrl,
    signatureMethod: signature.signatureMethod,
    signatureHash: signature.signatureHash,
    signatureImageHash: signature.signatureImageHash,
    documentHashAtSigning: signature.documentHashAtSigning,
    authenticationData: signature.authenticationData,
  };
}

const signRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/recipients/{recipientPublicId}/sign",
  request: {
    params: z.object({
      publicId: z.string(),
      recipientPublicId: z.string(),
    }),
    body: {
      content: {
        "application/json": { schema: signBodySchema },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: SignatureSchema } },
      description: "Signature recorded",
    },
    400: { description: "Recipient cannot sign" },
    404: { description: "Document or recipient not found" },
  },
});

app.openapi(signRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId, recipientPublicId } = c.req.valid("param");
  const input = c.req.valid("json");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const recipientRows = await db
    .select()
    .from(recipients)
    .where(
      and(
        eq(recipients.publicId, recipientPublicId),
        eq(recipients.documentId, doc.id)
      )
    )
    .limit(1);

  const recipient = recipientRows[0];
  if (!recipient) {
    return c.json({ error: "Recipient not found" }, 404);
  }

  if (recipient.status === "signed" || recipient.status === "declined") {
    return c.json({ error: "Recipient is in a terminal state" }, 400);
  }

  const now = new Date();
  const ipAddress =
    c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? null;

  const recipientStatus =
    recipient.role === "approver"
      ? "approved"
      : recipient.role === "viewer"
        ? "viewed"
        : "signed";

  await db
    .update(recipients)
    .set({
      status: recipientStatus,
      signedAt: recipientStatus === "signed" ? now : null,
      approvedAt: recipientStatus === "approved" ? now : null,
      viewedAt: recipientStatus === "viewed" ? now : null,
      updatedAt: now,
    })
    .where(eq(recipients.id, recipient.id));

  const signatureRows = await db
    .insert(signatures)
    .values({
      id: crypto.randomUUID(),
      fieldId: input.fieldId ?? null,
      recipientId: recipient.id,
      documentId: doc.id,
      signedAt: now,
      ipAddress,
      userAgent: input.userAgent ?? null,
      value: input.value ?? null,
      signatureImageUrl: input.signatureImageUrl ?? null,
      signatureMethod: input.signatureMethod ?? null,
      signatureHash: input.signatureHash ?? null,
      signatureImageHash: input.signatureImageHash ?? null,
      documentHashAtSigning: input.documentHashAtSigning ?? null,
      updatedAt: now,
    })
    .returning();

  const signature = signatureRows[0];
  if (!signature) {
    return c.json({ error: "Failed to record signature" }, 500);
  }

  await db.insert(activity).values({
    id: crypto.randomUUID(),
    organizationId,
    action: `recipient.${recipientStatus}`,
    actorName: recipient.name ?? recipient.email,
    targetName: doc.name,
    metadata: JSON.stringify({
      documentId: doc.id,
      publicId,
      recipientId: recipient.id,
    }),
    createdAt: now,
  });

  if (recipient.role === "signer") {
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
        .set({ status: "completed", updatedAt: now })
        .where(eq(documents.id, doc.id));
    }
  }

  return c.json(signatureResponse(signature), 201);
});

const listSignaturesRouteDef = createRoute({
  method: "get",
  path: "/{publicId}/signatures",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.array(SignatureSchema) },
      },
      description: "Signatures for the document",
    },
    404: { description: "Document not found" },
  },
});

app.openapi(listSignaturesRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const rows = await db
    .select()
    .from(signatures)
    .where(eq(signatures.documentId, doc.id))
    .orderBy(desc(signatures.signedAt));

  return c.json(rows.map(signatureResponse));
});

async function requireDocumentOwner(
  db: ReturnType<typeof createD1>,
  publicId: string,
  organizationId: string,
  userId: string
) {
  const rows = await db
    .select({ id: documents.id, ownerId: documents.ownerId })
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = rows[0];
  if (!doc) {
    return { ok: false, status: 404, error: "Document not found" } as const;
  }
  if (doc.ownerId !== userId) {
    return { ok: false, status: 403, error: "Forbidden" } as const;
  }
  return { ok: true, docId: doc.id } as const;
}

const deleteRouteDef = createRoute({
  method: "delete",
  path: "/{publicId}",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Document deleted",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

app.openapi(deleteRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const ownerCheck = await requireDocumentOwner(
    db,
    publicId,
    organizationId,
    userId
  );
  if (!ownerCheck.ok) {
    return c.json({ error: ownerCheck.error }, ownerCheck.status);
  }

  await db
    .update(documents)
    .set({ documentStatus: "deleted", updatedAt: new Date() })
    .where(eq(documents.id, ownerCheck.docId));

  return c.json({ success: true });
});

const sendDocumentBodySchema = z.object({
  expirationPeriod: z
    .object({
      amount: z.number().int(),
      unit: z.enum(["day", "week", "month"]),
    })
    .optional(),
  recipientMessages: z.record(z.string(), z.string()).optional(),
});

const sendRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/send",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: { "application/json": { schema: sendDocumentBodySchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Document sent",
    },
    400: { description: "Cannot send document" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

app.openapi(sendRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");
  const input = c.req.valid("json");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select({ id: documents.id, ownerId: documents.ownerId, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }
  if (doc.ownerId !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (doc.status !== "draft" && doc.status !== "expired") {
    return c.json(
      { error: `Cannot send document with status: ${doc.status}` },
      400
    );
  }

  const now = new Date();
  const expirationMs = input.expirationPeriod
    ? input.expirationPeriod.amount *
      (input.expirationPeriod.unit === "day"
        ? 24 * 60 * 60 * 1000
        : input.expirationPeriod.unit === "week"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000)
    : 30 * 24 * 60 * 60 * 1000;
  const tokenExpiresAt = new Date(now.getTime() + expirationMs);

  const recipientRows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.documentId, doc.id));

  const recipientUpdates = recipientRows.map((recipient) => {
    const token = recipient.signingToken ?? generateSigningToken();
    return {
      id: recipient.id,
      signingToken: token,
      tokenExpiresAt,
      updatedAt: now,
    };
  });

  await Promise.all(
    recipientUpdates.map((update) =>
      db.update(recipients).set(update).where(eq(recipients.id, update.id))
    )
  );

  await db
    .update(documents)
    .set({ status: "sent", sentAt: now, updatedAt: now })
    .where(eq(documents.id, doc.id));

  await db.insert(activity).values({
    id: crypto.randomUUID(),
    organizationId,
    action: "document.sent",
    actorName: user!.user.name ?? user!.user.email ?? "Unknown",
    targetName: doc.name,
    metadata: JSON.stringify({
      documentId: doc.id,
      publicId,
      recipientCount: recipientRows.length,
    }),
    createdAt: now,
  });

  return c.json({ success: true });
});

const cancelRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/cancel",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Document cancelled",
    },
    400: { description: "Cannot cancel document" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

app.openapi(cancelRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select({ id: documents.id, ownerId: documents.ownerId, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }
  if (doc.ownerId !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const terminalStatuses = ["completed", "cancelled", "declined", "expired"];
  if (terminalStatuses.includes(doc.status)) {
    return c.json(
      { error: `Cannot cancel document with status: ${doc.status}` },
      400
    );
  }

  await db
    .update(documents)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(documents.id, doc.id));

  return c.json({ success: true });
});

const moveDocumentsBodySchema = z.object({
  documentIds: z.array(z.string()).min(1),
  folderId: z.string().optional(),
});

const moveDocumentsRouteDef = createRoute({
  method: "post",
  path: "/move",
  request: {
    body: {
      content: {
        "application/json": { schema: moveDocumentsBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ moved: z.number().int() }) },
      },
      description: "Documents moved",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Folder not found" },
  },
});

app.openapi(moveDocumentsRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { documentIds, folderId } = c.req.valid("json");

  const db = createD1(c.env.D1);

  let targetFolderInternalId: string | null = null;
  if (folderId) {
    const folderRows = await db
      .select({ id: folders.id })
      .from(folders)
      .where(
        and(
          eq(folders.publicId, folderId),
          eq(folders.organizationId, organizationId)
        )
      )
      .limit(1);
    const folder = folderRows[0];
    if (!folder) {
      return c.json({ error: "Folder not found" }, 404);
    }
    targetFolderInternalId = folder.id;
  }

  const matchedRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, organizationId),
        inArray(documents.publicId, documentIds)
      )
    );

  const matchedIds = matchedRows.map((row) => row.id);

  if (matchedIds.length > 0) {
    await db
      .update(documents)
      .set({ folderId: targetFolderInternalId, updatedAt: new Date() })
      .where(inArray(documents.id, matchedIds));
  }

  return c.json({ moved: matchedIds.length });
});

const updateThumbnailBodySchema = z.object({
  thumbnailDataUrl: z.string().min(1),
});

const updateThumbnailRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/thumbnail",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateThumbnailBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: DocumentSchema },
      },
      description: "Thumbnail updated",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

app.openapi(updateThumbnailRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");
  const { thumbnailDataUrl } = c.req.valid("json");

  const db = createD1(c.env.D1);
  const ownerCheck = await requireDocumentOwner(
    db,
    publicId,
    organizationId,
    userId
  );
  if (!ownerCheck.ok) {
    return c.json({ error: ownerCheck.error }, ownerCheck.status);
  }

  await db
    .update(documents)
    .set({ thumbnailDataUrl, updatedAt: new Date() })
    .where(eq(documents.id, ownerCheck.docId));

  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, ownerCheck.docId))
    .limit(1);

  const updated = rows[0];
  if (!updated) {
    return c.json({ error: "Document not found" }, 404);
  }

  return c.json(documentResponse(updated));
});

const transferOwnershipBodySchema = z.object({
  newOwnerId: z.string(),
});

const transferOwnershipRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/transfer",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: transferOwnershipBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: DocumentSchema } },
      description: "Ownership transferred",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
    422: { description: "New owner is not an organization member" },
  },
});

app.openapi(transferOwnershipRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");
  const { newOwnerId } = c.req.valid("json");

  const db = createD1(c.env.D1);
  const ownerCheck = await requireDocumentOwner(
    db,
    publicId,
    organizationId,
    userId
  );
  if (!ownerCheck.ok) {
    return c.json({ error: ownerCheck.error }, ownerCheck.status);
  }

  const membership = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, newOwnerId)
      )
    )
    .limit(1);
  if (!membership[0]) {
    return c.json(
      { error: "New owner is not an organization member" },
      422
    );
  }

  await db
    .update(documents)
    .set({ ownerId: newOwnerId, updatedAt: new Date() })
    .where(eq(documents.id, ownerCheck.docId));

  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, ownerCheck.docId))
    .limit(1);

  const updated = rows[0];
  if (!updated) {
    return c.json({ error: "Document not found" }, 404);
  }

  return c.json(documentResponse(updated));
});

const SharingUserSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string(),
});

const SharingAccessSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string().nullable().optional(),
  userEmail: z.string(),
  permissionLevel: z.string(),
  grantedByName: z.string().nullable().optional(),
});

const SharingResponseSchema = z.object({
  sharingMode: z.string(),
  canUseTeamSharing: z.boolean(),
  subscriptionWarning: z.string().nullable().optional(),
  owner: SharingUserSchema,
  sharedWith: z.array(SharingAccessSchema),
});

const sharingRouteDef = createRoute({
  method: "get",
  path: "/{publicId}/sharing",
  request: {
    params: z.object({ publicId: z.string() }),
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: SharingResponseSchema },
      },
      description: "Document sharing state",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

app.openapi(sharingRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }

  const accessRows = await db
    .select()
    .from(documentAccess)
    .where(
      and(
        eq(documentAccess.documentId, doc.id),
        isNull(documentAccess.revokedAt)
      )
    );

  const userIds = new Set<string>([doc.ownerId]);
  for (const access of accessRows) {
    userIds.add(access.userId);
    if (access.grantedBy) {
      userIds.add(access.grantedBy);
    }
  }

  const userRows = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(inArray(userTable.id, Array.from(userIds)));

  const usersById = new Map(
    userRows.map((u) => [u.id, { name: u.name, email: u.email }])
  );

  const owner = usersById.get(doc.ownerId) ?? { name: null, email: "" };

  const sharedWith = accessRows.map((access) => {
    const accessUser = usersById.get(access.userId);
    const granter = access.grantedBy ? usersById.get(access.grantedBy) : null;
    return {
      id: access.id,
      userId: access.userId,
      userName: accessUser?.name,
      userEmail: accessUser?.email ?? "",
      permissionLevel: access.permissionLevel,
      grantedByName: granter?.name ?? granter?.email,
    };
  });

  return c.json({
    sharingMode: doc.sharingMode,
    canUseTeamSharing: true,
    subscriptionWarning: null,
    owner,
    sharedWith,
  });
});

const updateSharingBodySchema = z.object({
  sharingMode: z.enum(["private", "workspace", "specific"]),
});

const updateSharingRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/sharing",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: updateSharingBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: SharingResponseSchema } },
      description: "Sharing mode updated",
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

app.openapi(updateSharingRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");
  const { sharingMode } = c.req.valid("json");

  const db = createD1(c.env.D1);
  const ownerCheck = await requireDocumentOwner(
    db,
    publicId,
    organizationId,
    userId
  );
  if (!ownerCheck.ok) {
    return c.json({ error: ownerCheck.error }, ownerCheck.status);
  }

  await db
    .update(documents)
    .set({ sharingMode, updatedAt: new Date() })
    .where(eq(documents.id, ownerCheck.docId));

  return c.json({
    sharingMode,
    canUseTeamSharing: true,
    subscriptionWarning: null,
    owner: { name: null, email: "" },
    sharedWith: [],
  });
});

const shareBodySchema = z.object({
  userId: z.string(),
  permissionLevel: z.enum(["view", "edit", "manage"]),
});

const shareRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/share",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: { "application/json": { schema: shareBodySchema } },
    },
  },
  responses: {
    200: { description: "Access granted" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
    422: { description: "Invalid user" },
  },
});

app.openapi(shareRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");
  const { userId: targetUserId, permissionLevel } = c.req.valid("json");

  const db = createD1(c.env.D1);
  const ownerCheck = await requireDocumentOwner(
    db,
    publicId,
    organizationId,
    userId
  );
  if (!ownerCheck.ok) {
    return c.json({ error: ownerCheck.error }, ownerCheck.status);
  }

  const membership = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, targetUserId)
      )
    )
    .limit(1);
  if (!membership[0]) {
    return c.json({ error: "User is not an organization member" }, 422);
  }

  const existing = await db
    .select()
    .from(documentAccess)
    .where(
      and(
        eq(documentAccess.documentId, ownerCheck.docId),
        eq(documentAccess.userId, targetUserId)
      )
    )
    .limit(1);

  const now = new Date();
  if (existing[0]) {
    await db
      .update(documentAccess)
      .set({
        permissionLevel,
        revokedAt: null,
        revokedBy: null,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(eq(documentAccess.id, existing[0].id));
  } else {
    await db.insert(documentAccess).values({
      id: crypto.randomUUID(),
      documentId: ownerCheck.docId,
      userId: targetUserId,
      permissionLevel,
      grantedBy: userId,
      grantedAt: now,
    });
  }

  return c.json({ success: true });
});

const revokeBodySchema = z.object({
  userId: z.string(),
});

const revokeRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/revoke",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: { "application/json": { schema: revokeBodySchema } },
    },
  },
  responses: {
    200: { description: "Access revoked" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

app.openapi(revokeRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");
  const { userId: targetUserId } = c.req.valid("json");

  const db = createD1(c.env.D1);
  const ownerCheck = await requireDocumentOwner(
    db,
    publicId,
    organizationId,
    userId
  );
  if (!ownerCheck.ok) {
    return c.json({ error: ownerCheck.error }, ownerCheck.status);
  }

  await db
    .update(documentAccess)
    .set({
      revokedAt: new Date(),
      revokedBy: userId,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentAccess.documentId, ownerCheck.docId),
        eq(documentAccess.userId, targetUserId)
      )
    );

  return c.json({ success: true });
});

const updatePermissionBodySchema = z.object({
  userId: z.string(),
  permissionLevel: z.enum(["view", "edit", "manage"]),
});

const updatePermissionRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/permission",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: updatePermissionBodySchema },
      },
    },
  },
  responses: {
    200: { description: "Permission updated" },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Not found" },
  },
});

app.openapi(updatePermissionRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const userId = user!.user.id;
  const { publicId } = c.req.valid("param");
  const { userId: targetUserId, permissionLevel } = c.req.valid("json");

  const db = createD1(c.env.D1);
  const ownerCheck = await requireDocumentOwner(
    db,
    publicId,
    organizationId,
    userId
  );
  if (!ownerCheck.ok) {
    return c.json({ error: ownerCheck.error }, ownerCheck.status);
  }

  await db
    .update(documentAccess)
    .set({
      permissionLevel,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(documentAccess.documentId, ownerCheck.docId),
        eq(documentAccess.userId, targetUserId),
        isNull(documentAccess.revokedAt)
      )
    );

  return c.json({ success: true });
});

export default app;
