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
  recipients,
  signatures,
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
    aiProcessingStatus: z.string().nullable().optional(),
    storageKey: z.string().nullable().optional(),
    contentType: z.string().nullable().optional(),
    size: z.number().int().nullable().optional(),
    fileSize: z.number().int().nullable().optional(),
    pageCount: z.number().int().nullable().optional(),
    thumbnailDataUrl: z.string().nullable().optional(),
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
  aiProcessingStatus: string | null;
  storageKey: string | null;
  contentType: string | null;
  size: number | null;
  pageCount: number | null;
  thumbnailDataUrl: string | null;
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
    aiProcessingStatus: doc.aiProcessingStatus,
    storageKey: doc.storageKey,
    contentType: doc.contentType,
    size: doc.size,
    fileSize: doc.size,
    pageCount: doc.pageCount,
    thumbnailDataUrl: doc.thumbnailDataUrl,
    sentAt: doc.sentAt ? doc.sentAt.getTime() : null,
    deadline: doc.deadline ? doc.deadline.getTime() : null,
    createdAt: doc.createdAt.getTime(),
    updatedAt: doc.updatedAt.getTime(),
  };
}

function generatePublicId() {
  return crypto.randomUUID();
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

const createRouteDef = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ name: z.string().min(1) }),
        },
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
  },
});

app.openapi(createRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
  const { name } = c.req.valid("json");

  const db = createD1(c.env.D1);
  const publicId = generatePublicId();
  const now = new Date();

  const documentId = crypto.randomUUID();

  await db.insert(documents).values({
    id: documentId,
    publicId,
    organizationId,
    ownerId: user!.user.id,
    name,
    status: "draft",
    documentStatus: "active",
    sharingMode: "private",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(activity).values({
    id: crypto.randomUUID(),
    organizationId,
    action: "document.created",
    actorName: user!.user.name ?? user!.user.email ?? "Unknown",
    targetName: name,
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
    signedAt: z.number().nullable().optional(),
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
  signedAt: Date | null;
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
  signedAt: recipient.signedAt ? recipient.signedAt.getTime() : null,
  createdAt: recipient.createdAt.getTime(),
  updatedAt: recipient.updatedAt.getTime(),
});

const createRecipientBodySchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(["signer", "viewer"]).optional(),
});

const createRecipientRouteDef = createRoute({
  method: "post",
  path: "/{publicId}/recipients",
  request: {
    params: z.object({ publicId: z.string() }),
    body: {
      content: {
        "application/json": { schema: createRecipientBodySchema },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: RecipientSchema } },
      description: "Recipient added",
    },
    404: { description: "Document not found" },
  },
});

app.openapi(createRecipientRouteDef, async (c) => {
  const user = c.get("user");
  const organizationId = user!.session!.activeOrganizationId!;
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

  const countResult = await db
    .select({ value: count() })
    .from(recipients)
    .where(eq(recipients.documentId, doc.id));

  const now = new Date();
  const order = (countResult[0]?.value ?? 0) + 1;

  await db.insert(recipients).values({
    id: crypto.randomUUID(),
    publicId: crypto.randomUUID(),
    documentId: doc.id,
    name: input.name ?? null,
    email: input.email,
    role: input.role ?? "signer",
    order,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  const rows = await db
    .select()
    .from(recipients)
    .where(
      and(eq(recipients.documentId, doc.id), eq(recipients.email, input.email))
    )
    .orderBy(desc(recipients.createdAt))
    .limit(1);

  const recipient = rows[0];
  if (!recipient) {
    return c.json({ error: "Failed to create recipient" }, 500);
  }

  return c.json(recipientResponse(recipient), 201);
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

const SignatureSchema = z
  .object({
    id: z.string(),
    recipientId: z.string(),
    documentId: z.string(),
    signedAt: z.number(),
    ipAddress: z.string().nullable().optional(),
    value: z.string().nullable().optional(),
  })
  .openapi("Signature");

const signBodySchema = z.object({
  value: z.string().optional(),
});

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

  await db
    .update(recipients)
    .set({
      status: "signed",
      signedAt: now,
      updatedAt: now,
    })
    .where(eq(recipients.id, recipient.id));

  const signatureRows = await db
    .insert(signatures)
    .values({
      id: crypto.randomUUID(),
      recipientId: recipient.id,
      documentId: doc.id,
      signedAt: now,
      ipAddress,
      value: input.value ?? null,
    })
    .returning();

  const signature = signatureRows[0];
  if (!signature) {
    return c.json({ error: "Failed to record signature" }, 500);
  }

  await db.insert(activity).values({
    id: crypto.randomUUID(),
    organizationId,
    action: "recipient.signed",
    actorName: recipient.name ?? recipient.email,
    targetName: doc.name,
    metadata: JSON.stringify({
      documentId: doc.id,
      publicId,
      recipientId: recipient.id,
    }),
    createdAt: now,
  });

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

  return c.json(
    {
      id: signature.id,
      recipientId: signature.recipientId,
      documentId: signature.documentId,
      signedAt: signature.signedAt.getTime(),
      ipAddress: signature.ipAddress,
      value: signature.value,
    },
    201
  );
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

  return c.json(
    rows.map((signature) => ({
      id: signature.id,
      recipientId: signature.recipientId,
      documentId: signature.documentId,
      signedAt: signature.signedAt.getTime(),
      ipAddress: signature.ipAddress,
      value: signature.value,
    }))
  );
});

export default app;
