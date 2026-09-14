import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import { member, notifications, organization, user } from "../global/schema.js";
import type { Variables } from "../platform/types.js";
import notificationsRoute from "./notifications.js";

function createApp(_activeOrganizationId: string, userId = "user_1") {
  const app = new OpenAPIHono<{
    Bindings: CloudflareBindings;
    Variables: Variables;
  }>();

  app.use("/api/notifications/*", async (c, next) => {
    c.set("user", {
      user: { id: userId },
      session: { activeOrganizationId: _activeOrganizationId },
    });
    await next();
  });

  app.route("/api/notifications", notificationsRoute);
  return app;
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

const notificationSchema = z.object({
  _id: z.string(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
  read: z.boolean(),
});

const notificationListSchema = z.array(notificationSchema);
const countSchema = z.object({ count: z.number().int() });

describe("notifications API", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(notifications);
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

  it("lists notifications scoped to user and organization", async () => {
    const app = createApp("org_1", "user_1");

    const empty = await app.fetch(
      new Request("http://localhost:8787/api/notifications/test-org"),
      env
    );
    expect(empty.status).toBe(200);
    expect(notificationListSchema.parse(await parseJson(empty))).toEqual([]);

    const db = createD1(env.D1);
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      userId: "user_1",
      organizationId: "org_1",
      type: "document_shared",
      data: JSON.stringify({
        documentName: "Contract A",
        sharedByName: "Jane",
      }),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const listRes = await app.fetch(
      new Request("http://localhost:8787/api/notifications/test-org"),
      env
    );
    const list = notificationListSchema.parse(await parseJson(listRes));
    expect(list.length).toBe(1);
    expect(list[0]).toMatchObject({
      type: "document_shared",
      data: { documentName: "Contract A", sharedByName: "Jane" },
      read: false,
    });
  });

  it("does not return another user's notifications", async () => {
    const app = createApp("org_1", "user_1");
    const db = createD1(env.D1);

    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      userId: "user_2",
      organizationId: "org_1",
      type: "document_signed",
      data: JSON.stringify({ documentName: "Contract B" }),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const listRes = await app.fetch(
      new Request("http://localhost:8787/api/notifications/test-org"),
      env
    );
    const list = notificationListSchema.parse(await parseJson(listRes));
    expect(list.length).toBe(0);
  });

  it("returns unread count", async () => {
    const app = createApp("org_1", "user_1");
    const db = createD1(env.D1);

    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      userId: "user_1",
      organizationId: "org_1",
      type: "document_shared",
      data: JSON.stringify({}),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      userId: "user_1",
      organizationId: "org_1",
      type: "document_signed",
      data: JSON.stringify({}),
      read: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const countRes = await app.fetch(
      new Request(
        "http://localhost:8787/api/notifications/test-org/unread-count"
      ),
      env
    );
    const result = countSchema.parse(await parseJson(countRes));
    expect(result.count).toBe(1);
  });

  it("marks a notification as read", async () => {
    const app = createApp("org_1", "user_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      publicId,
      userId: "user_1",
      organizationId: "org_1",
      type: "document_shared",
      data: JSON.stringify({}),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const markRes = await app.fetch(
      new Request(
        `http://localhost:8787/api/notifications/test-org/${publicId}/read`,
        {
          method: "POST",
        }
      ),
      env
    );
    const updated = notificationSchema.parse(await parseJson(markRes));
    expect(updated.read).toBe(true);

    const countRes = await app.fetch(
      new Request(
        "http://localhost:8787/api/notifications/test-org/unread-count"
      ),
      env
    );
    const result = countSchema.parse(await parseJson(countRes));
    expect(result.count).toBe(0);
  });

  it("marks all notifications as read", async () => {
    const app = createApp("org_1", "user_1");
    const db = createD1(env.D1);

    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      userId: "user_1",
      organizationId: "org_1",
      type: "document_shared",
      data: JSON.stringify({}),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      userId: "user_1",
      organizationId: "org_1",
      type: "document_signed",
      data: JSON.stringify({}),
      read: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const markAllRes = await app.fetch(
      new Request("http://localhost:8787/api/notifications/test-org/read-all", {
        method: "POST",
      }),
      env
    );
    const result = countSchema.parse(await parseJson(markAllRes));
    expect(result.count).toBe(2);

    const countRes = await app.fetch(
      new Request(
        "http://localhost:8787/api/notifications/test-org/unread-count"
      ),
      env
    );
    const unread = countSchema.parse(await parseJson(countRes));
    expect(unread.count).toBe(0);
  });
});
