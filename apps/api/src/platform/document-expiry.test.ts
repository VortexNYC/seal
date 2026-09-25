import { eq } from "drizzle-orm";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import {
  auditChainTips,
  auditLogs,
  documents,
  organization,
  recipients,
} from "../global/schema.js";
import { commitDocumentExpiry } from "./document-expiry.js";

describe("commitDocumentExpiry", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(auditLogs);
    await db.delete(auditChainTips);
    await db.delete(recipients);
    await db.delete(documents);
    await db.delete(organization);
  });

  it("expires document + pending recipients with audit in one batch", async () => {
    const db = createD1(env.D1);
    const deadline = new Date(Date.now() - 60_000);

    await db.insert(organization).values({
      id: "org_exp",
      name: "Expiry Org",
      slug: "expiry-org",
    });

    await db.insert(documents).values({
      id: "doc_exp",
      publicId: "doc_pub_exp",
      organizationId: "org_exp",
      name: "Expired Document",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      deadline,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(recipients).values([
      {
        id: "rec_exp_pending",
        publicId: "rec_pub_exp_pending",
        documentId: "doc_exp",
        email: "pending@example.com",
        role: "signer",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "rec_exp_signed",
        publicId: "rec_pub_exp_signed",
        documentId: "doc_exp",
        email: "signed@example.com",
        role: "signer",
        status: "signed",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const won = await commitDocumentExpiry(db, {
      documentId: "doc_exp",
      organizationId: "org_exp",
      publicId: "doc_pub_exp",
      deadline,
      pendingRecipientIds: ["rec_exp_pending"],
    });
    expect(won).toBe(true);

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, "doc_exp"));
    expect(doc?.status).toBe("expired");

    const recipientRows = await db.select().from(recipients);
    const byId = Object.fromEntries(recipientRows.map((r) => [r.id, r]));
    expect(byId.rec_exp_pending?.status).toBe("expired");
    expect(byId.rec_exp_signed?.status).toBe("signed");

    const audits = await db.select().from(auditLogs);
    expect(audits.map((a) => a.action).sort()).toEqual([
      "document.expired",
      "recipient.expired",
    ]);
  });

  it("is first-writer-wins — second expire writes no duplicate audit", async () => {
    const db = createD1(env.D1);
    const deadline = new Date(Date.now() - 60_000);

    await db.insert(organization).values({
      id: "org_exp2",
      name: "Expiry Org 2",
      slug: "expiry-org-2",
    });

    await db.insert(documents).values({
      id: "doc_exp2",
      publicId: "doc_pub_exp2",
      organizationId: "org_exp2",
      name: "Expired Document 2",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      deadline,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const input = {
      documentId: "doc_exp2",
      organizationId: "org_exp2",
      publicId: "doc_pub_exp2",
      deadline,
      pendingRecipientIds: [] as string[],
    };

    expect(await commitDocumentExpiry(db, input)).toBe(true);
    expect(await commitDocumentExpiry(db, input)).toBe(false);

    const audits = await db.select().from(auditLogs);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.action).toBe("document.expired");
  });
});
