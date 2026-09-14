import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import {
  contacts,
  documents,
  member,
  organization,
  recipients,
  user,
} from "../global/schema.js";
import type { Variables } from "../platform/types.js";
import contactsRoute from "./contacts.js";

function createApp(_activeOrganizationId: string) {
  const app = new OpenAPIHono<{
    Bindings: CloudflareBindings;
    Variables: Variables;
  }>();

  app.use("/api/contacts/*", async (c, next) => {
    c.set("user", {
      user: { id: "user_1" },
      session: { activeOrganizationId: _activeOrganizationId },
    });
    await next();
  });

  app.route("/api/contacts", contactsRoute);
  return app;
}

async function parseJson(response: Response): Promise<unknown> {
  return response.json();
}

const contactIdSchema = z.object({ id: z.string() });
const contactResponseSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  status: z.string(),
});
const contactListSchema = z.array(contactResponseSchema);
const emailLookupSchema = z.object({ email: z.string() }).nullable();
const bulkResultSchema = z.array(
  z.object({ id: z.string(), success: z.boolean() })
);
const relatedDocumentSchema = z.array(
  z.object({ id: z.string(), name: z.string(), workflowStatus: z.string() })
);

describe("contacts API", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(contacts);
    await db.delete(recipients);
    await db.delete(documents);
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
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: "org_2",
      userId: "user_1",
      role: "owner",
      createdAt: new Date(),
    });
  });

  it("lists contacts scoped to the active organization", async () => {
    const app = createApp("org_1");

    const empty = await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org"),
      env
    );
    expect(empty.status).toBe(200);
    expect(contactListSchema.parse(await parseJson(empty))).toEqual([]);

    const createRes = await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          status: "active",
        }),
      }),
      env
    );
    expect(createRes.status).toBe(201);
    const created = contactIdSchema.parse(await parseJson(createRes));

    const listRes = await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org"),
      env
    );
    const list = contactListSchema.parse(await parseJson(listRes));
    expect(list.length).toBe(1);
    expect(list[0]).toMatchObject({
      id: created.id,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      status: "active",
    });
  });

  it("filters contacts by status and search", async () => {
    const app = createApp("org_1");

    await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          status: "active",
        }),
      }),
      env
    );

    await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@example.com",
          status: "lead",
        }),
      }),
      env
    );

    const statusRes = await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org?status=lead"),
      env
    );
    const statusList = contactListSchema.parse(await parseJson(statusRes));
    expect(statusList.length).toBe(1);
    expect(statusList[0]).toMatchObject({ firstName: "Jane" });

    const searchRes = await app.fetch(
      new Request(
        "http://localhost:8787/api/contacts/test-org?search=doe&status=active"
      ),
      env
    );
    const searchList = contactListSchema.parse(await parseJson(searchRes));
    expect(searchList.length).toBe(1);
    expect(searchList[0]).toMatchObject({ firstName: "John" });
  });

  it("gets a contact by public id", async () => {
    const app = createApp("org_1");

    const createRes = await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          status: "active",
        }),
      }),
      env
    );
    const created = contactIdSchema.parse(await parseJson(createRes));

    const getRes = await app.fetch(
      new Request(`http://localhost:8787/api/contacts/test-org/${created.id}`),
      env
    );
    expect(getRes.status).toBe(200);
    const contact = contactResponseSchema.parse(await parseJson(getRes));
    expect(contact.firstName).toBe("John");
  });

  it("returns 404 for a contact in another organization", async () => {
    const app1 = createApp("org_1");
    const createRes = await app1.fetch(
      new Request("http://localhost:8787/api/contacts/test-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          status: "active",
        }),
      }),
      env
    );
    const created = contactIdSchema.parse(await parseJson(createRes));

    const app2 = createApp("org_2");
    const getRes = await app2.fetch(
      new Request(`http://localhost:8787/api/contacts/other-org/${created.id}`),
      env
    );
    expect(getRes.status).toBe(404);

    const deleteRes = await app2.fetch(
      new Request(
        `http://localhost:8787/api/contacts/other-org/${created.id}`,
        {
          method: "DELETE",
        }
      ),
      env
    );
    expect(deleteRes.status).toBe(404);
  });

  it("updates and deletes a contact", async () => {
    const app = createApp("org_1");

    const createRes = await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          status: "active",
        }),
      }),
      env
    );
    const created = contactIdSchema.parse(await parseJson(createRes));

    const patchRes = await app.fetch(
      new Request(`http://localhost:8787/api/contacts/test-org/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Jonathan" }),
      }),
      env
    );
    expect(patchRes.status).toBe(200);
    const updated = contactResponseSchema.parse(await parseJson(patchRes));
    expect(updated.firstName).toBe("Jonathan");

    const deleteRes = await app.fetch(
      new Request(`http://localhost:8787/api/contacts/test-org/${created.id}`, {
        method: "DELETE",
      }),
      env
    );
    expect(deleteRes.status).toBe(204);

    const getRes = await app.fetch(
      new Request(`http://localhost:8787/api/contacts/test-org/${created.id}`),
      env
    );
    expect(getRes.status).toBe(404);
  });

  it("bulk deletes contacts", async () => {
    const app = createApp("org_1");

    const createA = await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          status: "active",
        }),
      }),
      env
    );
    const contactA = contactIdSchema.parse(await parseJson(createA));

    const createB = await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          status: "active",
        }),
      }),
      env
    );
    const contactB = contactIdSchema.parse(await parseJson(createB));

    const bulkRes = await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [contactA.id, contactB.id, "missing-id"],
        }),
      }),
      env
    );
    const results = bulkResultSchema.parse(await parseJson(bulkRes));
    expect(results).toEqual([
      { id: contactA.id, success: true },
      { id: contactB.id, success: true },
      { id: "missing-id", success: false },
    ]);

    const listRes = await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org"),
      env
    );
    const list = contactListSchema.parse(await parseJson(listRes));
    expect(list.length).toBe(0);
  });

  it("looks up a contact by email", async () => {
    const app = createApp("org_1");

    await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          status: "active",
        }),
      }),
      env
    );

    const emailRes = await app.fetch(
      new Request(
        "http://localhost:8787/api/contacts/test-org/by-email?email=john@example.com"
      ),
      env
    );
    expect(emailRes.status).toBe(200);
    const contact = emailLookupSchema.parse(await parseJson(emailRes));
    expect(contact?.email).toBe("john@example.com");

    const missingRes = await app.fetch(
      new Request(
        "http://localhost:8787/api/contacts/test-org/by-email?email=jane@example.com"
      ),
      env
    );
    expect(missingRes.status).toBe(200);
    expect(await parseJson(missingRes)).toBeNull();
  });

  it("returns related documents for a contact email", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    await app.fetch(
      new Request("http://localhost:8787/api/contacts/test-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          status: "active",
        }),
      }),
      env
    );

    const docId = crypto.randomUUID();
    const docPublicId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId: docPublicId,
      organizationId: "org_1",
      name: "Contract A",
      status: "draft",
    });
    await db.insert(recipients).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      documentId: docId,
      name: "John Doe",
      email: "john@example.com",
      role: "signer",
      status: "pending",
    });

    const relatedRes = await app.fetch(
      new Request(
        "http://localhost:8787/api/contacts/test-org/related-documents?email=john@example.com"
      ),
      env
    );
    const related = relatedDocumentSchema.parse(await parseJson(relatedRes));
    expect(related.length).toBe(1);
    expect(related[0]).toMatchObject({ id: docPublicId, name: "Contract A" });
  });
});
