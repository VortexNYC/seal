import { eq } from "drizzle-orm";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import {
  activity,
  auditLogs,
  documents,
  organization,
  recipients,
  signatures,
} from "../global/schema.js";
import {
  commitSigningSubmit,
  RecipientAlreadyCompletedError,
} from "./signing-submit.js";

describe("commitSigningSubmit", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(signatures);
    await db.delete(activity);
    await db.delete(auditLogs);
    await db.delete(recipients);
    await db.delete(documents);
    await db.delete(organization);
  });

  it("loses the race without leaving orphan evidence", async () => {
    const db = createD1(env.D1);
    const now = new Date();

    await db.insert(organization).values({
      id: "org_batch",
      name: "Batch Org",
      slug: "batch-org",
    });
    await db.insert(documents).values({
      id: "doc_batch",
      publicId: "doc_pub_batch",
      organizationId: "org_batch",
      name: "Batch Doc",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(recipients).values({
      id: "rec_batch",
      publicId: "rec_pub_batch",
      documentId: "doc_batch",
      email: "batch@example.com",
      name: "Batch Signer",
      role: "signer",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    const base = {
      recipientId: "rec_batch",
      recipientUpdate: {
        status: "signed",
        signedAt: now,
        updatedAt: now,
      },
    };

    await commitSigningSubmit(db, {
      ...base,
      audit: {
        id: crypto.randomUUID(),
        organizationId: "org_batch",
        actor: { type: "user", id: "rec_batch" },
        action: "recipient.signed",
        resourceType: "recipient",
        resourceId: "rec_batch",
        createdAt: now,
      },
      signature: {
        id: crypto.randomUUID(),
        documentId: "doc_batch",
        recipientId: "rec_batch",
        value: "Batch Signer",
        signatureMethod: "type",
        signedAt: now,
      },
      activityRow: {
        id: crypto.randomUUID(),
        organizationId: "org_batch",
        action: "recipient.signed",
        actorName: "Batch Signer",
        targetName: "Batch Doc",
        metadata: { documentId: "doc_batch" },
        createdAt: now,
      },
    });

    const loserAuditId = crypto.randomUUID();
    const loserSigId = crypto.randomUUID();
    const loserActId = crypto.randomUUID();

    await expect(
      commitSigningSubmit(db, {
        ...base,
        audit: {
          id: loserAuditId,
          organizationId: "org_batch",
          actor: { type: "user", id: "rec_batch" },
          action: "recipient.signed",
          resourceType: "recipient",
          resourceId: "rec_batch",
          createdAt: now,
        },
        signature: {
          id: loserSigId,
          documentId: "doc_batch",
          recipientId: "rec_batch",
          value: "Batch Signer",
          signatureMethod: "type",
          signedAt: now,
        },
        activityRow: {
          id: loserActId,
          organizationId: "org_batch",
          action: "recipient.signed",
          actorName: "Batch Signer",
          targetName: "Batch Doc",
          metadata: { documentId: "doc_batch" },
          createdAt: now,
        },
      })
    ).rejects.toBeInstanceOf(RecipientAlreadyCompletedError);

    expect(await db.select().from(signatures)).toHaveLength(1);
    expect(await db.select().from(activity)).toHaveLength(1);
    expect(await db.select().from(auditLogs)).toHaveLength(1);

    const [recipient] = await db
      .select()
      .from(recipients)
      .where(eq(recipients.id, "rec_batch"));
    expect(recipient?.status).toBe("signed");
  });
});
