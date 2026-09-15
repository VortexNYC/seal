import { create, insert, search, type Results } from "@orama/orama";
import { and, eq, or, sql } from "drizzle-orm";

import { createD1 } from "../../global/db.js";
import {
  contacts,
  documentAccess,
  documents,
  templates,
} from "../../global/schema.js";

export type SearchResult = {
  id: string;
  type: "document" | "contact" | "template";
  title: string;
  snippet: string | null;
};

const schema = {
  publicId: "string",
  type: "string",
  title: "string",
  body: "string",
} as const;

export interface SearchOptions {
  query: string;
  types?: ("document" | "contact" | "template")[];
  limit?: number;
}

function documentReadCondition(userId: string) {
  const specificAccess = sql`EXISTS (SELECT 1 FROM ${documentAccess} WHERE ${documentAccess.documentId} = ${documents.id} AND ${documentAccess.userId} = ${userId} AND ${documentAccess.revokedAt} IS NULL)`;
  return or(
    eq(documents.ownerId, userId),
    eq(documents.sharingMode, "workspace"),
    and(eq(documents.sharingMode, "specific"), specificAccess)
  );
}

export async function searchOrganization(
  env: CloudflareBindings,
  organizationId: string,
  userId: string,
  options: SearchOptions
): Promise<SearchResult[]> {
  const db = createD1(env.D1);
  const index = create({ schema });

  const enabledTypes = new Set(
    options.types ?? ["document", "contact", "template"]
  );

  if (enabledTypes.has("document")) {
    const rows = await db
      .select({
        publicId: documents.publicId,
        name: documents.name,
        parsedText: documents.parsedText,
      })
      .from(documents)
      .where(
        and(
          eq(documents.organizationId, organizationId),
          documentReadCondition(userId)
        )
      );

    for (const row of rows) {
      await insert(index, {
        publicId: row.publicId,
        type: "document",
        title: row.name,
        body: row.parsedText ?? "",
      });
    }
  }

  if (enabledTypes.has("contact")) {
    const rows = await db
      .select({
        publicId: contacts.publicId,
        fullName: contacts.fullName,
        email: contacts.email,
        company: contacts.company,
        title: contacts.title,
        notes: contacts.notes,
      })
      .from(contacts)
      .where(eq(contacts.organizationId, organizationId));

    for (const row of rows) {
      const body = [
        row.email,
        row.company ?? "",
        row.title ?? "",
        row.notes ?? "",
      ]
        .filter(Boolean)
        .join(" ");

      await insert(index, {
        publicId: row.publicId,
        type: "contact",
        title: row.fullName,
        body,
      });
    }
  }

  if (enabledTypes.has("template")) {
    const rows = await db
      .select({
        publicId: templates.publicId,
        name: templates.name,
        description: templates.description,
      })
      .from(templates)
      .where(eq(templates.organizationId, organizationId));

    for (const row of rows) {
      await insert(index, {
        publicId: row.publicId,
        type: "template",
        title: row.name,
        body: row.description ?? "",
      });
    }
  }

  const results = (await search(index, {
    term: options.query,
    limit: options.limit ?? 20,
    properties: ["title", "body"],
  })) as Results<typeof schema>;

  return results.hits.map((hit) => ({
    id: hit.document.publicId,
    type: hit.document.type as SearchResult["type"],
    title: hit.document.title,
    snippet: hit.document.body.slice(0, 120) || null,
  }));
}
