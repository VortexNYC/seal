import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import { folders, organization } from "../global/schema.js";
import type { SessionUser } from "../platform/session.js";
import foldersRoute from "./folders.js";

function createApp(activeOrganizationId: string, userId = "user_1") {
  const app = new OpenAPIHono<{
    Bindings: CloudflareBindings;
    Variables: { user: SessionUser | null };
  }>();

  app.use("/api/folders/*", async (c, next) => {
    c.set("user", {
      user: { id: userId, name: "Test User", email: "test@example.com" },
      session: { activeOrganizationId },
    });
    await next();
  });

  app.route("/api/folders", foldersRoute);
  return app;
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

const folderSchema = z.object({
  publicId: z.string(),
  name: z.string(),
  type: z.string(),
  parentId: z.string().nullable().optional(),
});

const folderListSchema = z.array(folderSchema);

describe("folders API", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
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

  it("lists folders scoped to the active organization", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    await db.insert(folders).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: "org_1",
      name: "Folder A",
      type: "document",
      visibility: "everyone",
      createdBy: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(folders).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: "org_2",
      name: "Folder B",
      type: "document",
      visibility: "everyone",
      createdBy: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request("http://localhost:8787/api/folders"),
      env
    );
    const list = folderListSchema.parse(await parseJson(response));
    expect(list.length).toBe(1);
    expect(list[0]?.name).toBe("Folder A");
  });

  it("returns folder breadcrumbs", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const grandparentPublicId = crypto.randomUUID();
    const parentPublicId = crypto.randomUUID();
    const childPublicId = crypto.randomUUID();

    const grandparentId = crypto.randomUUID();
    const parentId = crypto.randomUUID();
    const childId = crypto.randomUUID();

    await db.insert(folders).values({
      id: grandparentId,
      publicId: grandparentPublicId,
      organizationId: "org_1",
      name: "Grandparent",
      type: "document",
      visibility: "everyone",
      createdBy: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(folders).values({
      id: parentId,
      publicId: parentPublicId,
      organizationId: "org_1",
      parentId: grandparentId,
      name: "Parent",
      type: "document",
      visibility: "everyone",
      createdBy: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(folders).values({
      id: childId,
      publicId: childPublicId,
      organizationId: "org_1",
      parentId: parentId,
      name: "Child",
      type: "document",
      visibility: "everyone",
      createdBy: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/folders/${childPublicId}/breadcrumbs`
      ),
      env
    );
    const breadcrumbs = z.array(z.object({ id: z.string(), name: z.string() })).parse(
      await parseJson(response)
    );
    expect(breadcrumbs.length).toBe(3);
    expect(breadcrumbs[0]?.name).toBe("Grandparent");
    expect(breadcrumbs[1]?.name).toBe("Parent");
    expect(breadcrumbs[2]?.name).toBe("Child");
    expect(breadcrumbs[0]?.id).toBe(grandparentPublicId);
  });

  it("creates a folder", async () => {
    const app = createApp("org_1");

    const response = await app.fetch(
      new Request("http://localhost:8787/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Folder", type: "document" }),
      }),
      env
    );
    const folder = folderSchema.parse(await parseJson(response));
    expect(folder.name).toBe("New Folder");
    expect(folder.type).toBe("document");
  });

  it("creates a nested folder", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const parentPublicId = crypto.randomUUID();
    await db.insert(folders).values({
      id: crypto.randomUUID(),
      publicId: parentPublicId,
      organizationId: "org_1",
      name: "Parent",
      type: "document",
      visibility: "everyone",
      createdBy: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request("http://localhost:8787/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Child",
          type: "document",
          parentId: parentPublicId,
        }),
      }),
      env
    );
    const folder = folderSchema.parse(await parseJson(response));
    expect(folder.name).toBe("Child");
    expect(folder.parentId).toBe(parentPublicId);
  });

  it("returns all folders flat with parent public ids", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const parentPublicId = crypto.randomUUID();
    const parentId = crypto.randomUUID();
    await db.insert(folders).values({
      id: parentId,
      publicId: parentPublicId,
      organizationId: "org_1",
      name: "Parent",
      type: "document",
      visibility: "everyone",
      createdBy: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(folders).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      organizationId: "org_1",
      parentId,
      name: "Child",
      type: "document",
      visibility: "everyone",
      createdBy: "user_1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request("http://localhost:8787/api/folders/all?type=document"),
      env
    );
    const all = folderListSchema.parse(await parseJson(response));
    expect(all.length).toBe(2);
    const child = all.find((f) => f.name === "Child");
    expect(child?.parentId).toBe(parentPublicId);
  });
});
