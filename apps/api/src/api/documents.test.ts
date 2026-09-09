import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import { documents, folders, member, organization, user } from "../global/schema.js";
import type { SessionUser } from "../platform/session.js";
import documentsRoute from "./documents.js";

function createApp(activeOrganizationId: string, userId = "user_1") {
  const app = new OpenAPIHono<{
    Bindings: CloudflareBindings;
    Variables: { user: SessionUser | null };
  }>();

  app.use("/api/documents/*", async (c, next) => {
    c.set("user", {
      user: { id: userId, name: "Test User", email: "test@example.com" },
      session: { activeOrganizationId },
    });
    await next();
  });

  app.route("/api/documents", documentsRoute);
  return app;
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

const documentSchema = z.object({
  publicId: z.string(),
  name: z.string(),
  ownerId: z.string(),
  status: z.string(),
  workflowStatus: z.string(),
});

const documentListSchema = z.array(documentSchema);

describe("documents API", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(documents);
    await db.delete(folders);
    await db.delete(member);
    await db.delete(user);
    await db.delete(organization);

    await db.insert(organization).values({
      id: "org_1",
      name: "Test Org",
      slug: "test-org",
    });
    await db.insert(organization).values({
      id: "org_2",
      name: "Other Org",
      slug: "other-org",
    });
    await db.insert(user).values({
      id: "user_1",
      name: "Test User",
      email: "test@example.com",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: "org_1",
      userId: "user_1",
      role: "owner",
      createdAt: new Date(),
    });
  });

  it("lists documents scoped to the active organization", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Contract A",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: "org_2",
      ownerId: "user_1",
      name: "Contract B",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request("http://localhost:8787/api/documents"),
      env
    );
    const list = documentListSchema.parse(await parseJson(response));
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe("Contract A");
  });

  it("filters documents by workflow status", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Draft Doc",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Sent Doc",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request("http://localhost:8787/api/documents?workflowStatus=sent"),
      env
    );
    const list = documentListSchema.parse(await parseJson(response));
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe("Sent Doc");
  });

  it("filters documents by folder", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const folderId = crypto.randomUUID();
    const folderPublicId = crypto.randomUUID();
    await db.insert(folders).values({
      id: folderId,
      publicId: folderPublicId,
      organizationId: "org_1",
      name: "Folder A",
      type: "document",
      visibility: "everyone",
      createdBy: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: "org_1",
      ownerId: "user_1",
      folderId,
      name: "In Folder",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Root Doc",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents?folderId=${folderPublicId}`
      ),
      env
    );
    const list = documentListSchema.parse(await parseJson(response));
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe("In Folder");
  });

  it("filters documents by owner", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Owned Doc",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: "org_1",
      ownerId: "user_2",
      name: "Other Doc",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request("http://localhost:8787/api/documents?filter=owned"),
      env
    );
    const list = documentListSchema.parse(await parseJson(response));
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe("Owned Doc");
  });

  it("deletes a document", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Delete Me",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}`,
        { method: "DELETE" }
      ),
      env
    );
    const result = z.object({ success: z.boolean() }).parse(await parseJson(response));
    expect(result.success).toBe(true);

    const rows = await db
      .select({ documentStatus: documents.documentStatus })
      .from(documents)
      .where(eq(documents.publicId, publicId));
    expect(rows[0]?.documentStatus).toBe("deleted");
  });

  it("sends a draft document", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Send Me",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/send`,
        { method: "POST" }
      ),
      env
    );
    const result = z.object({ success: z.boolean() }).parse(await parseJson(response));
    expect(result.success).toBe(true);

    const rows = await db
      .select({ status: documents.status })
      .from(documents)
      .where(eq(documents.publicId, publicId));
    expect(rows[0]?.status).toBe("sent");
  });

  it("cancels a sent document", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Cancel Me",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/cancel`,
        { method: "POST" }
      ),
      env
    );
    const result = z.object({ success: z.boolean() }).parse(await parseJson(response));
    expect(result.success).toBe(true);

    const rows = await db
      .select({ status: documents.status })
      .from(documents)
      .where(eq(documents.publicId, publicId));
    expect(rows[0]?.status).toBe("cancelled");
  });

  it("moves documents to a folder", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const folderId = crypto.randomUUID();
    const folderPublicId = crypto.randomUUID();
    await db.insert(folders).values({
      id: folderId,
      publicId: folderPublicId,
      organizationId: "org_1",
      name: "Target",
      type: "document",
      visibility: "everyone",
      createdBy: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const publicId = crypto.randomUUID();
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Move Me",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request("http://localhost:8787/api/documents/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: [publicId], folderId: folderPublicId }),
      }),
      env
    );
    const result = z.object({ moved: z.number() }).parse(await parseJson(response));
    expect(result.moved).toBe(1);

    const rows = await db
      .select({ folderId: documents.folderId })
      .from(documents)
      .where(eq(documents.publicId, publicId));
    expect(rows[0]?.folderId).toBe(folderId);
  });

  it("transfers document ownership", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    await db.insert(user).values({
      id: "user_2",
      name: "New Owner",
      email: "new@example.com",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: "org_1",
      userId: "user_2",
      role: "member",
      createdAt: new Date(),
    });

    const publicId = crypto.randomUUID();
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Transfer Me",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newOwnerId: "user_2" }),
        }
      ),
      env
    );
    const result = documentSchema.parse(await parseJson(response));
    expect(result.ownerId).toBe("user_2");

    const rows = await db
      .select({ ownerId: documents.ownerId })
      .from(documents)
      .where(eq(documents.publicId, publicId));
    expect(rows[0]?.ownerId).toBe("user_2");
  });
});
