import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import {
  documents,
  folders,
  member,
  organization,
  paymentFieldConfigs,
  recipients,
  signatureFields,
  signatures,
  user,
} from "../global/schema.js";
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
      new Request(`http://localhost:8787/api/documents/${publicId}`, {
        method: "DELETE",
      }),
      env
    );
    const result = z
      .object({ success: z.boolean() })
      .parse(await parseJson(response));
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
      new Request(`http://localhost:8787/api/documents/${publicId}/send`, {
        method: "POST",
      }),
      env
    );
    const result = z
      .object({ success: z.boolean() })
      .parse(await parseJson(response));
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
      new Request(`http://localhost:8787/api/documents/${publicId}/cancel`, {
        method: "POST",
      }),
      env
    );
    const result = z
      .object({ success: z.boolean() })
      .parse(await parseJson(response));
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
        body: JSON.stringify({
          documentIds: [publicId],
          folderId: folderPublicId,
        }),
      }),
      env
    );
    const result = z
      .object({ moved: z.number() })
      .parse(await parseJson(response));
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
      new Request(`http://localhost:8787/api/documents/${publicId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId: "user_2" }),
      }),
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

  it("grants and lists document sharing", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    await db.insert(user).values({
      id: "user_2",
      name: "Shared User",
      email: "shared@example.com",
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
      name: "Share Me",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const shareResponse = await app.fetch(
      new Request(`http://localhost:8787/api/documents/${publicId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user_2", permissionLevel: "view" }),
      }),
      env
    );
    expect(shareResponse.status).toBe(200);

    const sharingResponse = await app.fetch(
      new Request(`http://localhost:8787/api/documents/${publicId}/sharing`),
      env
    );
    const sharing = z
      .object({
        sharingMode: z.string(),
        owner: z.object({ name: z.string().nullable(), email: z.string() }),
        sharedWith: z.array(
          z.object({
            userId: z.string(),
            userEmail: z.string(),
            permissionLevel: z.string(),
          })
        ),
      })
      .parse(await parseJson(sharingResponse));
    expect(sharing.sharedWith.length).toBe(1);
    expect(sharing.sharedWith[0]?.userId).toBe("user_2");
    expect(sharing.sharedWith[0]?.permissionLevel).toBe("view");
  });

  it("lists signature fields for a document", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Field Doc",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fieldId = crypto.randomUUID();
    await db.insert(signatureFields).values({
      id: fieldId,
      publicId: crypto.randomUUID(),
      documentId: docId,
      fieldType: "signature",
      label: "Sign here",
      isRequired: true,
      isMainSignature: true,
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
      page: 1,
      properties: JSON.stringify({ placeholder: "tap to sign" }),
      validationRules: JSON.stringify({ required: true }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/signature-fields`
      ),
      env
    );
    const fields = z
      .array(
        z.object({
          id: z.string(),
          fieldType: z.string(),
          label: z.string(),
          page: z.number(),
          properties: z
            .object({ placeholder: z.string().optional() })
            .nullable(),
        })
      )
      .parse(await parseJson(response));
    expect(fields.length).toBe(1);
    expect(fields[0]?.fieldType).toBe("signature");
    expect(fields[0]?.properties?.placeholder).toBe("tap to sign");
  });

  it("lists payment configs for a document", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Payment Doc",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fieldId = crypto.randomUUID();
    await db.insert(signatureFields).values({
      id: fieldId,
      publicId: crypto.randomUUID(),
      documentId: docId,
      fieldType: "payment",
      label: "Pay here",
      isRequired: true,
      isMainSignature: false,
      x: 0.5,
      y: 0.6,
      width: 0.2,
      height: 0.1,
      page: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(paymentFieldConfigs).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      fieldId,
      documentId: docId,
      organizationId: "org_1",
      paymentType: "one_time",
      items: JSON.stringify([
        { id: "item-1", description: "Service", quantity: 1, unitPrice: 10000 },
      ]),
      currency: "usd",
      dueDateTerms: "on_receipt",
      allowedPaymentMethods: JSON.stringify(["card"]),
      feeHandling: "absorb",
      taxEnabled: false,
      totalAmountCents: 10000,
      paymentStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/payment-configs`
      ),
      env
    );
    const configs = z
      .array(
        z.object({
          fieldId: z.string(),
          paymentType: z.string(),
          totalAmountCents: z.number(),
          currency: z.string(),
          paymentStatus: z.string().nullable(),
        })
      )
      .parse(await parseJson(response));
    expect(configs.length).toBe(1);
    expect(configs[0]?.totalAmountCents).toBe(10000);
    expect(configs[0]?.paymentStatus).toBe("pending");
  });

  it("returns recipient progress for a document", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Progress Doc",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(recipients).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      documentId: docId,
      email: "signer1@example.com",
      name: "Signer One",
      role: "signer",
      order: 1,
      status: "signed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(recipients).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      documentId: docId,
      email: "signer2@example.com",
      name: "Signer Two",
      role: "signer",
      order: 2,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/recipients/progress`
      ),
      env
    );
    const progress = z
      .object({
        total: z.number(),
        completed: z.number(),
        percentComplete: z.number(),
        byStatus: z.object({
          pending: z.number(),
          viewed: z.number(),
          signed: z.number(),
          approved: z.number(),
          declined: z.number(),
          expired: z.number(),
        }),
        byRole: z.object({
          signer: z.object({ total: z.number(), completed: z.number() }),
        }),
      })
      .parse(await parseJson(response));
    expect(progress.total).toBe(2);
    expect(progress.completed).toBe(1);
    expect(progress.percentComplete).toBe(50);
    expect(progress.byStatus.signed).toBe(1);
    expect(progress.byStatus.pending).toBe(1);
    expect(progress.byRole.signer.total).toBe(2);
    expect(progress.byRole.signer.completed).toBe(1);
  });

  it("returns the current user's recipient record", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Me Doc",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(recipients).values({
      id: crypto.randomUUID(),
      publicId: crypto.randomUUID(),
      documentId: docId,
      email: "test@example.com",
      name: "Test User",
      role: "signer",
      order: 1,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/recipients/me`
      ),
      env
    );
    const me = z
      .object({
        email: z.string(),
        role: z.string(),
        status: z.string(),
      })
      .nullable()
      .parse(await parseJson(response));
    expect(me?.email).toBe("test@example.com");
    expect(me?.role).toBe("signer");
  });

  it("updates document metadata", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Update Me",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(`http://localhost:8787/api/documents/${publicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Updated Name",
          description: "New description",
          redirectUrl: "https://example.com/signed",
          allowDictateNextSigner: true,
        }),
      }),
      env
    );
    const result = z
      .object({
        name: z.string(),
        description: z.string().nullable(),
        redirectUrl: z.string().nullable(),
        allowDictateNextSigner: z.boolean(),
      })
      .parse(await parseJson(response));
    expect(result.name).toBe("Updated Name");
    expect(result.description).toBe("New description");
    expect(result.redirectUrl).toBe("https://example.com/signed");
    expect(result.allowDictateNextSigner).toBe(true);
  });

  it("returns current-user signature fields with values", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "My Fields",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const recipientId = crypto.randomUUID();
    await db.insert(recipients).values({
      id: recipientId,
      publicId: crypto.randomUUID(),
      documentId: docId,
      email: "test@example.com",
      name: "Test User",
      role: "signer",
      order: 1,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const fieldId = crypto.randomUUID();
    await db.insert(signatureFields).values({
      id: fieldId,
      publicId: crypto.randomUUID(),
      documentId: docId,
      recipientId,
      fieldType: "signature",
      label: "Sign here",
      isRequired: true,
      isMainSignature: true,
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
      page: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(signatures).values({
      id: crypto.randomUUID(),
      fieldId,
      documentId: docId,
      recipientId,
      signedAt: new Date(),
      value: "John Hancock",
      signatureImageUrl: "https://cdn.example.com/sig.png",
      signatureMethod: "draw",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/signature-fields/me`
      ),
      env
    );
    const fields = z
      .array(
        z.object({
          id: z.string(),
          fieldType: z.string(),
          isFilled: z.boolean(),
          currentValue: z.string().nullable().optional(),
          currentSignatureImageUrl: z.string().nullable().optional(),
          signatureDetails: z
            .object({
              signedAt: z.number(),
              signerEmail: z.string().nullable().optional(),
              signatureMethod: z.string().nullable().optional(),
            })
            .nullable()
            .optional(),
        })
      )
      .parse(await parseJson(response));
    expect(fields.length).toBe(1);
    expect(fields[0]?.isFilled).toBe(true);
    expect(fields[0]?.currentValue).toBe("John Hancock");
    expect(fields[0]?.currentSignatureImageUrl).toBe(
      "https://cdn.example.com/sig.png"
    );
    expect(fields[0]?.signatureDetails?.signatureMethod).toBe("draw");
  });

  it("adds recipients to a document", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Add Recipients",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/recipients`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients: [
              { email: "a@example.com", name: "A" },
              { email: "b@example.com", name: "B", role: "viewer" },
            ],
          }),
        }
      ),
      env
    );
    const result = z
      .array(z.object({ email: z.string(), role: z.string() }))
      .parse(await parseJson(response));
    expect(result.length).toBe(2);
    expect(result[0]?.email).toBe("a@example.com");
    expect(result[1]?.role).toBe("viewer");
  });

  it("removes a recipient and their fields", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Remove Recipient",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const recipientPublicId = crypto.randomUUID();
    await db.insert(recipients).values({
      id: crypto.randomUUID(),
      publicId: recipientPublicId,
      documentId: docId,
      email: "remove@example.com",
      name: "Remove Me",
      role: "signer",
      order: 1,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/recipients/${recipientPublicId}`,
        { method: "DELETE" }
      ),
      env
    );
    const result = z
      .object({ success: z.boolean() })
      .parse(await parseJson(response));
    expect(result.success).toBe(true);
  });

  it("resends a recipient email by rotating the signing token", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Resend",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const recipientPublicId = crypto.randomUUID();
    const oldToken = crypto.randomUUID();
    await db.insert(recipients).values({
      id: crypto.randomUUID(),
      publicId: recipientPublicId,
      documentId: docId,
      email: "resend@example.com",
      role: "signer",
      order: 1,
      status: "pending",
      signingToken: oldToken,
      tokenExpiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/recipients/${recipientPublicId}/resend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      ),
      env
    );
    const result = z
      .object({ success: z.boolean() })
      .parse(await parseJson(response));
    expect(result.success).toBe(true);

    const updated = await db
      .select({ signingToken: recipients.signingToken })
      .from(recipients)
      .where(eq(recipients.publicId, recipientPublicId))
      .limit(1);
    expect(updated[0]?.signingToken).not.toBe(oldToken);
  });

  it("creates, repositions, assigns, and deletes a signature field", async () => {
    const app = createApp("org_1");
    const db = createD1(env.D1);

    const publicId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    await db.insert(documents).values({
      id: docId,
      publicId,
      organizationId: "org_1",
      ownerId: "user_1",
      name: "Field CRUD",
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      pageCount: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const recipientPublicId = crypto.randomUUID();
    await db.insert(recipients).values({
      id: crypto.randomUUID(),
      publicId: recipientPublicId,
      documentId: docId,
      email: "field@example.com",
      name: "Field User",
      role: "signer",
      order: 1,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const createResponse = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/signature-fields`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientPublicId,
            fieldType: "signature",
            label: "Sign here",
            isRequired: true,
            x: 10,
            y: 20,
            width: 30,
            height: 40,
            page: 1,
          }),
        }
      ),
      env
    );
    const created = z
      .object({
        id: z.string(),
        publicId: z.string(),
        isMainSignature: z.boolean(),
        x: z.number(),
      })
      .parse(await parseJson(createResponse));
    expect(created.isMainSignature).toBe(true);

    const fieldPublicId = created.publicId;

    const repositionResponse = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/signature-fields/${fieldPublicId}/position`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: 15, y: 25 }),
        }
      ),
      env
    );
    const repositioned = z
      .object({ x: z.number(), y: z.number() })
      .parse(await parseJson(repositionResponse));
    expect(repositioned.x).toBe(15);

    const updateResponse = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/signature-fields/${fieldPublicId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: "Updated label" }),
        }
      ),
      env
    );
    const updated = z
      .object({ label: z.string() })
      .parse(await parseJson(updateResponse));
    expect(updated.label).toBe("Updated label");

    const deleteResponse = await app.fetch(
      new Request(
        `http://localhost:8787/api/documents/${publicId}/signature-fields/${fieldPublicId}`,
        { method: "DELETE" }
      ),
      env
    );
    const deleted = z
      .object({ success: z.boolean() })
      .parse(await parseJson(deleteResponse));
    expect(deleted.success).toBe(true);
  });
});
