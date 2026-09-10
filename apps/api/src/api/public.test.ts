import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import { documents, organization, recipients } from "../global/schema.js";
import publicRoute from "./public.js";

function createApp() {
  const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
  app.route("/api/public", publicRoute);
  return app;
}

describe("public API", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(recipients);
    await db.delete(documents);
    await db.delete(organization);
  });

  it("returns unknown when no CF-Connecting-IP header is present", async () => {
    const app = createApp();

    const response = await app.fetch(
      new Request("http://localhost:8787/api/public/ip"),
      env
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ip: "unknown" });
  });

  it("uploads an attachment for a valid signing token", async () => {
    const db = createD1(env.D1);
    const bucket = env.DOCUMENTS_BUCKET;

    await db.insert(organization).values({
      id: "org_attach",
      name: "Attachment Org",
      slug: "attachment-org",
    });

    await db.insert(documents).values({
      id: "doc_attach",
      publicId: "doc_pub_attach",
      organizationId: "org_attach",
      name: "Attachment Document",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = "sign-token-attach";
    await db.insert(recipients).values({
      id: "rec_attach",
      publicId: "rec_pub_attach",
      documentId: "doc_attach",
      email: "signer@example.com",
      signingToken: token,
      tokenExpiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = createApp();
    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/public/signing/${token}/attachments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentBase64: btoa("hello attachment"),
            contentType: "text/plain",
          }),
        }
      ),
      env
    );

    expect(response.status).toBe(200);
    const result = z
      .object({
        storageKey: z.string(),
        contentType: z.string(),
        size: z.number(),
      })
      .parse(await response.json());

    expect(result.contentType).toBe("text/plain");
    expect(result.size).toBe(16);

    const stored = await bucket.head(result.storageKey);
    expect(stored).not.toBeNull();
    expect(stored?.size).toBe(16);
    expect(stored?.httpMetadata?.contentType).toBe("text/plain");
  });

  it("verifies a completed document by qr token", async () => {
    const db = createD1(env.D1);

    await db.insert(organization).values({
      id: "org_verify",
      name: "Verify Org",
      slug: "verify-org",
    });

    const qrToken = "qr-token-123";
    const completedAt = new Date();
    await db.insert(documents).values({
      id: "doc_verify",
      publicId: "doc_pub_verify",
      organizationId: "org_verify",
      name: "Verified Document",
      status: "completed",
      documentStatus: "active",
      sharingMode: "private",
      qrToken,
      completedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const signedAt = new Date();
    await db.insert(recipients).values({
      id: "rec_verify",
      publicId: "rec_pub_verify",
      documentId: "doc_verify",
      name: "Alice Signer",
      email: "alice@example.com",
      role: "signer",
      status: "signed",
      signedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = createApp();
    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/public/verify/${encodeURIComponent(qrToken)}`
      ),
      env
    );

    expect(response.status).toBe(200);
    const result = z
      .object({
        verified: z.literal(true),
        documentName: z.string(),
        completedAt: z.number().nullable(),
        signerCount: z.number(),
        signers: z.array(
          z.object({
            name: z.string(),
            maskedEmail: z.string(),
            role: z.string(),
            signedAt: z.number().nullable(),
          })
        ),
        documentHash: z.null(),
        createdAt: z.number(),
      })
      .parse(await response.json());

    expect(result.documentName).toBe("Verified Document");
    expect(result.signerCount).toBe(1);
    const signer = result.signers[0];
    expect(signer).toBeDefined();
    if (signer) {
      expect(signer.name).toBe("Alice Signer");
      expect(signer.maskedEmail).toBe("a****@example.com");
    }
  });

  it("returns null for an unknown qr token", async () => {
    const app = createApp();
    const response = await app.fetch(
      new Request("http://localhost:8787/api/public/verify/unknown-qr-token"),
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });
});
