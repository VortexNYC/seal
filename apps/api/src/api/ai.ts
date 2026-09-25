import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  aiDocumentAnnotations,
  aiFieldSuggestions,
  documents,
  member,
  organization,
} from "../global/schema.js";
import { extractAnnotationsFromMarkdown } from "../platform/document-annotations.js";
import {
  applySuggestionItems,
  materializeSuggestionsFromCandidates,
  suggestionItemSchema,
} from "../platform/field-suggestions.js";
import {
  FeatureDisabledError,
  assertAiEnabled,
} from "../platform/org-settings.js";
import type { Variables } from "../platform/types.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

app.use("/*", async (c, next) => {
  const sessionUser = c.get("user");
  if (!sessionUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const pathname = new URL(c.req.url).pathname;
  const segments = pathname.split("/").filter(Boolean);
  const rootSegment = segments[2];
  if (!rootSegment) {
    return c.json({ error: "Not found" }, 404);
  }

  const db = createD1(c.env.D1);

  const docRows = await db
    .select({ organizationId: documents.organizationId })
    .from(documents)
    .where(eq(documents.publicId, rootSegment))
    .limit(1);
  const organizationId = docRows[0]?.organizationId ?? null;

  if (!organizationId) {
    return c.json({ error: "Not found" }, 404);
  }

  const [orgRow, membershipRow] = await Promise.all([
    db
      .select()
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1),
    db
      .select()
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, sessionUser.user.id)
        )
      )
      .limit(1),
  ]);

  if (!orgRow[0] || membershipRow.length === 0) {
    return c.json({ error: "Not found" }, 404);
  }

  try {
    await assertAiEnabled(c.env, organizationId);
  } catch (error) {
    if (error instanceof FeatureDisabledError) {
      return c.json({ error: error.code }, 403);
    }
    throw error;
  }

  c.set("organization", orgRow[0]);
  return next();
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
    const candidateRows = await db
      .select({
        id: documents.id,
        fieldCandidates: documents.fieldCandidates,
      })
      .from(documents)
      .where(
        and(
          eq(documents.publicId, publicId),
          eq(documents.organizationId, organizationId)
        )
      )
      .limit(1);
    const candidateDoc = candidateRows[0];
    if (!candidateDoc) {
      return c.json(null, 200);
    }
    const materialized = await materializeSuggestionsFromCandidates(db, {
      documentId: candidateDoc.id,
      organizationId,
      candidatesJson: candidateDoc.fieldCandidates,
    });
    if (!materialized) {
      return c.json(null, 200);
    }
    return c.json(
      {
        id: materialized.id,
        publicId: materialized.publicId,
        documentId: candidateDoc.id,
        organizationId,
        fields: materialized.fields,
        modelUsed: materialized.modelUsed,
        tokensUsed: materialized.tokensUsed,
        processingTimeMs: materialized.processingTimeMs,
        status: materialized.status,
        createdAt: materialized.createdAt.getTime(),
        updatedAt: materialized.updatedAt.getTime(),
      },
      200
    );
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
    const candidateRows = await db
      .select({
        id: documents.id,
        parsedText: documents.parsedText,
      })
      .from(documents)
      .where(
        and(
          eq(documents.publicId, publicId),
          eq(documents.organizationId, organizationId)
        )
      )
      .limit(1);
    const candidateDoc = candidateRows[0];
    if (!candidateDoc?.parsedText) {
      return c.json(null, 200);
    }
    const items = extractAnnotationsFromMarkdown(candidateDoc.parsedText);
    if (items.length === 0) {
      return c.json(null, 200);
    }
    const id = crypto.randomUUID();
    const suggestionPublicId = crypto.randomUUID();
    const now = new Date();
    await db.insert(aiDocumentAnnotations).values({
      id,
      publicId: suggestionPublicId,
      documentId: candidateDoc.id,
      organizationId,
      annotations: JSON.stringify(items),
      modelUsed: "anydoc-heuristics",
      tokensUsed: 0,
      processingTimeMs: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return c.json(
      {
        id,
        publicId: suggestionPublicId,
        documentId: candidateDoc.id,
        organizationId,
        annotations: items,
        modelUsed: "anydoc-heuristics",
        tokensUsed: 0,
        processingTimeMs: 0,
        status: "active",
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      },
      200
    );
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
  const organizationId = c.get("organization").id;
  const { publicId, suggestionId } = c.req.valid("param");
  const { selectedFieldIndices } = c.req.valid("json");

  const db = createD1(c.env.D1);

  const docRows = await db
    .select({
      id: documents.id,
      status: documents.status,
      pageCount: documents.pageCount,
    })
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
    return c.json({ fieldIds: [] as string[], count: 0 }, 200);
  }
  if (doc.status !== "draft") {
    return c.json({ fieldIds: [] as string[], count: 0 }, 200);
  }

  const suggestionRows = await db
    .select()
    .from(aiFieldSuggestions)
    .where(
      and(
        eq(aiFieldSuggestions.publicId, suggestionId),
        eq(aiFieldSuggestions.documentId, doc.id),
        eq(aiFieldSuggestions.organizationId, organizationId),
        eq(aiFieldSuggestions.status, "pending")
      )
    )
    .limit(1);

  const suggestion = suggestionRows[0];
  if (!suggestion) {
    return c.json({ fieldIds: [] as string[], count: 0 }, 200);
  }

  let rawFields: unknown;
  try {
    rawFields = JSON.parse(suggestion.fields) as unknown;
  } catch {
    return c.json({ fieldIds: [] as string[], count: 0 }, 200);
  }

  const parsedFields = z.array(suggestionItemSchema).safeParse(rawFields);
  if (!parsedFields.success) {
    return c.json({ fieldIds: [] as string[], count: 0 }, 200);
  }

  const result = await applySuggestionItems(db, {
    documentId: doc.id,
    pageCount: doc.pageCount,
    items: parsedFields.data,
    selectedFieldIndices,
  });

  await db
    .update(aiFieldSuggestions)
    .set({ status: "applied", updatedAt: new Date() })
    .where(eq(aiFieldSuggestions.id, suggestion.id));

  return c.json(result, 200);
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

export default app;
