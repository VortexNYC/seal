import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import { documents, folders, organization } from "../global/schema.js";
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
});
