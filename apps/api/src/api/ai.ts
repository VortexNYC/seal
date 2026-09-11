import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  aiDocumentAnnotations,
  aiFieldSuggestions,
  aiProgress,
  aiThreads,
  documents,
} from "../global/schema.js";
import type { Variables } from "../platform/types.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

const suggestionItemSchema = z.object({
  fieldType: z.string(),
  page: z.number().int(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  label: z.string(),
  confidence: z.number(),
  isRequired: z.boolean(),
});

const fieldSuggestionSchema = z
  .object({
    id: z.string(),
    publicId: z.string(),
    documentId: z.string(),
    organizationId: z.string(),
    fields: z.array(suggestionItemSchema),
    modelUsed: z.string(),
    tokensUsed: z.number().int(),
    processingTimeMs: z.number().int(),
    status: z.string(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .nullable()
  .openapi("FieldSuggestions");

const getFieldSuggestionsRoute = createRoute({
  method: "get",
  path: "/:publicId/field-suggestions",
  request: { params: z.object({ publicId: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: fieldSuggestionSchema } },
      description: "Pending field suggestions for the document",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
  },
});

app.openapi(getFieldSuggestionsRoute, async (c) => {
  const organizationId = c.get("organization").id;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);

  const docRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const docRow = docRows[0];
  if (!docRow) {
    return c.json(null, 200);
  }

  const documentId = docRow.id;

  const rows = await db
    .select()
    .from(aiFieldSuggestions)
    .where(
      and(
        eq(aiFieldSuggestions.documentId, documentId),
        eq(aiFieldSuggestions.status, "pending")
      )
    )
    .orderBy(desc(aiFieldSuggestions.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json(null, 200);
  }

  return c.json(
    {
      id: row.id,
      publicId: row.publicId,
      documentId: row.documentId,
      organizationId: row.organizationId,
      fields: JSON.parse(row.fields),
      modelUsed: row.modelUsed,
      tokensUsed: row.tokensUsed,
      processingTimeMs: row.processingTimeMs,
      status: row.status,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    },
    200
  );
});

const annotationItemSchema = z.object({
  page: z.number().int(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  category: z.enum(["obligation", "payment", "risk", "dates", "terms"]),
  severity: z.enum(["informational", "important", "critical"]),
  text: z.string(),
  summary: z.string(),
});

const documentAnnotationsSchema = z
  .object({
    id: z.string(),
    publicId: z.string(),
    documentId: z.string(),
    organizationId: z.string(),
    annotations: z.array(annotationItemSchema),
    modelUsed: z.string(),
    tokensUsed: z.number().int(),
    processingTimeMs: z.number().int(),
    status: z.string(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .nullable()
  .openapi("DocumentAnnotations");

const getAnnotationsRoute = createRoute({
  method: "get",
  path: "/:publicId/annotations",
  request: { params: z.object({ publicId: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: documentAnnotationsSchema } },
      description: "Active annotations for the document",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
  },
});

app.openapi(getAnnotationsRoute, async (c) => {
  const organizationId = c.get("organization").id;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);

  const docRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const docRow = docRows[0];
  if (!docRow) {
    return c.json(null, 200);
  }

  const documentId = docRow.id;

  const rows = await db
    .select()
    .from(aiDocumentAnnotations)
    .where(
      and(
        eq(aiDocumentAnnotations.documentId, documentId),
        eq(aiDocumentAnnotations.status, "active")
      )
    )
    .orderBy(desc(aiDocumentAnnotations.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json(null, 200);
  }

  return c.json(
    {
      id: row.id,
      publicId: row.publicId,
      documentId: row.documentId,
      organizationId: row.organizationId,
      annotations: JSON.parse(row.annotations),
      modelUsed: row.modelUsed,
      tokensUsed: row.tokensUsed,
      processingTimeMs: row.processingTimeMs,
      status: row.status,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    },
    200
  );
});

const threadResponseSchema = z
  .object({
    threadId: z.string().nullable(),
  })
  .openapi("DocumentThread");

const getThreadRoute = createRoute({
  method: "get",
  path: "/:publicId/thread",
  request: { params: z.object({ publicId: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: threadResponseSchema } },
      description: "Thread for the document",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
  },
});

app.openapi(getThreadRoute, async (c) => {
  const organizationId = c.get("organization").id;
  const userId = c.get("user")!.user.id;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);

  const docRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const docRow = docRows[0];
  if (!docRow) {
    return c.json({ threadId: null }, 200);
  }

  const documentId = docRow.id;

  const rows = await db
    .select({ threadId: aiThreads.threadId })
    .from(aiThreads)
    .where(
      and(
        eq(aiThreads.documentId, documentId),
        eq(aiThreads.organizationId, organizationId),
        eq(aiThreads.userId, userId)
      )
    )
    .limit(1);

  const threadRow = rows[0];
  return c.json({ threadId: threadRow?.threadId ?? null }, 200);
});

const getOrCreateThreadRoute = createRoute({
  method: "post",
  path: "/:publicId/thread",
  request: { params: z.object({ publicId: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: threadResponseSchema } },
      description: "Created or existing thread",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
  },
});

function generatePublicId(): string {
  return crypto.randomUUID();
}

app.openapi(getOrCreateThreadRoute, async (c) => {
  const organizationId = c.get("organization").id;
  const userId = c.get("user")!.user.id;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);

  const docRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const docRow = docRows[0];
  if (!docRow) {
    return c.json({ threadId: null }, 200);
  }

  const documentId = docRow.id;

  const existing = await db
    .select({ threadId: aiThreads.threadId })
    .from(aiThreads)
    .where(
      and(
        eq(aiThreads.documentId, documentId),
        eq(aiThreads.organizationId, organizationId),
        eq(aiThreads.userId, userId)
      )
    )
    .limit(1);

  const existingThread = existing[0];
  if (existingThread?.threadId) {
    return c.json({ threadId: existingThread.threadId }, 200);
  }

  const threadId = generatePublicId();
  const publicId2 = generatePublicId();
  const now = new Date();

  await db.insert(aiThreads).values({
    id: generatePublicId(),
    publicId: publicId2,
    threadId,
    documentId,
    organizationId,
    userId,
    threadType: "document",
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ threadId }, 200);
});

const dismissAnnotationsRoute = createRoute({
  method: "post",
  path: "/:publicId/annotations/dismiss",
  request: { params: z.object({ publicId: z.string() }) },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Annotations dismissed",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
  },
});

app.openapi(dismissAnnotationsRoute, async (c) => {
  const organizationId = c.get("organization").id;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);

  const docRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const docRow = docRows[0];
  if (!docRow) {
    return c.json({ success: true }, 200);
  }

  await db
    .update(aiDocumentAnnotations)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(
      and(
        eq(aiDocumentAnnotations.documentId, docRow.id),
        eq(aiDocumentAnnotations.organizationId, organizationId),
        eq(aiDocumentAnnotations.status, "active")
      )
    );

  return c.json({ success: true }, 200);
});

const applyFieldSuggestionsRoute = createRoute({
  method: "post",
  path: "/:publicId/field-suggestions/:suggestionId/apply",
  request: {
    params: z.object({ publicId: z.string(), suggestionId: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            selectedFieldIndices: z.array(z.number().int()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            fieldIds: z.array(z.string()),
            count: z.number().int(),
          }),
        },
      },
      description: "Field suggestions applied",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
  },
});

app.openapi(applyFieldSuggestionsRoute, async (c) => {
  const { selectedFieldIndices } = c.req.valid("json");
  void selectedFieldIndices;

  return c.json({ fieldIds: [] as string[], count: 0 }, 200);
});

const dismissFieldSuggestionsRoute = createRoute({
  method: "post",
  path: "/:publicId/field-suggestions/dismiss",
  request: { params: z.object({ publicId: z.string() }) },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Field suggestions dismissed",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
  },
});

app.openapi(dismissFieldSuggestionsRoute, async (c) => {
  const organizationId = c.get("organization").id;
  const { publicId } = c.req.valid("param");

  const db = createD1(c.env.D1);

  const docRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);

  const docRow = docRows[0];
  if (!docRow) {
    return c.json({ success: true }, 200);
  }

  await db
    .update(aiFieldSuggestions)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(
      and(
        eq(aiFieldSuggestions.documentId, docRow.id),
        eq(aiFieldSuggestions.organizationId, organizationId),
        eq(aiFieldSuggestions.status, "pending")
      )
    );

  return c.json({ success: true }, 200);
});

const aiProgressStatusSchema = z.enum([
  "in_progress",
  "completed",
  "failed",
  "aborted",
]);

const progressSchema = z
  .object({
    threadId: z.string(),
    step: z.number().int(),
    totalSteps: z.number().int().nullable().optional(),
    completedTools: z.array(z.string()),
    tokensUsed: z.number().int(),
    status: aiProgressStatusSchema,
    error: z.string().nullable().optional(),
    createdAt: z.number().int(),
    updatedAt: z.number().int(),
  })
  .nullable()
  .openapi("AIProgress");

const getProgressRoute = createRoute({
  method: "get",
  path: "/progress/:threadId",
  request: { params: z.object({ threadId: z.string() }) },
  responses: {
    200: {
      content: { "application/json": { schema: progressSchema } },
      description: "AI progress for the thread",
    },
    401: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Unauthorized",
    },
    403: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Forbidden",
    },
  },
});

app.openapi(getProgressRoute, async (c) => {
  const organizationId = c.get("organization").id;
  const { threadId } = c.req.valid("param");

  const db = createD1(c.env.D1);

  const threadRows = await db
    .select({ id: aiThreads.id })
    .from(aiThreads)
    .where(
      and(
        eq(aiThreads.threadId, threadId),
        eq(aiThreads.organizationId, organizationId),
        eq(aiThreads.userId, c.get("user")!.user.id)
      )
    )
    .limit(1);

  if (threadRows.length === 0) {
    return c.json(null, 200);
  }

  const rows = await db
    .select()
    .from(aiProgress)
    .where(eq(aiProgress.threadId, threadId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json(null, 200);
  }

  return c.json(
    {
      threadId: row.threadId,
      step: row.step,
      totalSteps: row.totalSteps,
      completedTools: JSON.parse(row.completedTools),
      tokensUsed: row.tokensUsed,
      status: aiProgressStatusSchema.parse(row.status),
      error: row.error,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    },
    200
  );
});

export default app;
