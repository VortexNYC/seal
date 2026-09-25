import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import { auditLogs, documents, organization } from "../global/schema.js";
import app from "../index.js";

describe("SEA-68 break-glass document read", () => {
  it("logs admin.break_glass.read then returns object bytes", async () => {
    const db = createD1(env.D1);
    const orgId = crypto.randomUUID();
    const docId = crypto.randomUUID();
    const storageKey = `orgs/${orgId}/docs/${docId}.pdf`;

    await db.insert(organization).values({
      id: orgId,
      name: "Break Glass Org",
      slug: `bg-${crypto.randomUUID().slice(0, 8)}`,
    });
    await db.insert(documents).values({
      id: docId,
      publicId: `pub_${crypto.randomUUID().slice(0, 8)}`,
      organizationId: orgId,
      name: "Secret.pdf",
      status: "completed",
      documentStatus: "active",
      sharingMode: "private",
      storageKey,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await env.DOCUMENTS_BUCKET.put(storageKey, "PDF-BYTES-SEA-68", {
      httpMetadata: { contentType: "application/pdf" },
    });

    const key = env.INTERNAL_API_KEY;
    expect(key?.length).toBeGreaterThan(16);

    const res = await app.fetch(
      new Request("http://localhost:8787/internal/break-glass/document-read", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-api-key": key,
        },
        body: JSON.stringify({
          organizationId: orgId,
          documentId: docId,
          reason: "Support ticket — verify customer PDF corruption",
          operatorEmail: "ops@vortex.nyc",
          ticketRef: "SEA-68",
        }),
      }),
      env
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("x-seal-break-glass")).toBe("1");
    expect(new TextDecoder().decode(await res.arrayBuffer())).toBe(
      "PDF-BYTES-SEA-68"
    );

    const rows = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, orgId));
    const bg = rows.find((r) => r.action === "admin.break_glass.read");
    expect(bg).toBeTruthy();
    expect(bg?.actorId).toBe("break-glass:ops@vortex.nyc");
    expect(bg?.resourceId).toBe(docId);
    expect(bg?.metadata).toContain("Support ticket");
  });

  it("rejects short reasons", async () => {
    const key = env.INTERNAL_API_KEY;
    const res = await app.fetch(
      new Request("http://localhost:8787/internal/break-glass/document-read", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-api-key": key,
        },
        body: JSON.stringify({
          organizationId: "org_x",
          documentId: "doc_x",
          reason: "too-short",
          operatorEmail: "ops@vortex.nyc",
        }),
      }),
      env
    );
    expect(res.status).toBe(400);
  });
});
