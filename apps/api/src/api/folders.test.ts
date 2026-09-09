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
});
