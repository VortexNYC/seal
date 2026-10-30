import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import {
  activity,
  auditChainTips,
  auditLogs,
  documents,
  organization,
  paymentFieldConfigs,
  recipients,
  signatureFields,
  signatures,
  webhookDeliveries,
  webhooks,
} from "../global/schema.js";
import { sha256PdfBytes } from "../platform/final-pdf.js";
import publicRoute from "./public.js";

/** Existing public submit tests exercise token/auth gates without a Seal session. */
const ANONYMOUS_SIGN_ORG_METADATA = JSON.stringify({
  signingSettings: {
    requireSignerAccount: false,
    requireRecipientAuth: false,
  },
});

function createApp() {
  const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
  app.route("/api/public", publicRoute);
  return app;
}

const consentFields = {
  esignConsentAt: new Date(),
  esignConsentIp: "203.0.113.1",
  esignConsentVersion: "2026-03-esign-v1",
  esignConsentTextHash: "sha256:test",
  privacyNoticeAt: new Date(),
  privacyNoticeIp: "203.0.113.1",
  privacyNoticeVersion: "seal-privacy-1",
  privacyNoticeTextHash: "sha256:privacy-test",
};

describe("public API", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(webhookDeliveries);
    await db.delete(webhooks);
    await db.delete(signatures);
    await db.delete(activity);
    await db.delete(auditLogs);
    await db.delete(auditChainTips);
    await db.delete(paymentFieldConfigs);
    await db.delete(signatureFields);
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

  it("verifies a sealed PDF by upload (hash match)", async () => {
    const db = createD1(env.D1);

    await db.insert(organization).values({
      id: "org_verify_up",
      name: "Verify Org",
      slug: "verify-org-up",
    });

    const pdfBytes = new TextEncoder().encode("%PDF-1.4 fake-sealed-bytes");
    const documentHash = await sha256PdfBytes(pdfBytes);
    const completedAt = new Date();
    await db.insert(documents).values({
      id: "doc_verify_up",
      publicId: "doc_pub_verify_up",
      organizationId: "org_verify_up",
      name: "Sealed Contract",
      status: "completed",
      documentStatus: "active",
      sharingMode: "private",
      documentHash,
      completedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(recipients).values({
      id: "rec_verify_up",
      publicId: "rec_pub_verify_up",
      documentId: "doc_verify_up",
      name: "Bob Signer",
      email: "bob@example.com",
      role: "signer",
      status: "signed",
      signedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = createApp();
    const response = await app.fetch(
      new Request("http://localhost:8787/api/public/verify-upload", {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: pdfBytes,
      }),
      env
    );

    expect(response.status).toBe(200);
    const result = z
      .object({
        verified: z.literal(true),
        hashMatch: z.literal(true),
        documentName: z.string(),
        signerCount: z.number(),
        signers: z.array(
          z.object({ name: z.string(), maskedEmail: z.string() })
        ),
      })
      .parse(await response.json());
    expect(result.documentName).toBe("Sealed Contract");
    expect(result.signerCount).toBe(1);
    expect(result.signers[0]?.maskedEmail).toBe("b****@example.com");
  });

  it("rejects tampered bytes — hash miss is unverified, not 404", async () => {
    const app = createApp();
    const response = await app.fetch(
      new Request("http://localhost:8787/api/public/verify-upload", {
        method: "POST",
        headers: { "content-type": "application/pdf" },
        body: new TextEncoder().encode("%PDF-1.4 altered"),
      }),
      env
    );
    expect(response.status).toBe(200);
    const result = z
      .object({ verified: z.literal(false), hashMatch: z.literal(false) })
      .parse(await response.json());
    expect(result.verified).toBe(false);
  });

  it("verify-upload rejects non-PDF bodies", async () => {
    const app = createApp();
    const response = await app.fetch(
      new Request("http://localhost:8787/api/public/verify-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      env
    );
    expect(response.status).toBe(400);
  });

  it("returns the hosted pay link on the signer payment config", async () => {
    const db = createD1(env.D1);
    await db.insert(organization).values({
      id: "org_link",
      name: "Link Org",
      slug: "link-org",
      createdAt: new Date(),
    });
    await db.insert(documents).values({
      id: "doc_link",
      publicId: "doc_pub_link",
      organizationId: "org_link",
      name: "Link Document",
      status: "waiting_for_payment",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = "pay-link-token";
    await db.insert(recipients).values({
      id: "rec_link",
      publicId: "rec_pub_link",
      documentId: "doc_link",
      email: "payer@example.com",
      name: "Payer",
      role: "signer",
      status: "signed",
      signingToken: token,
      tokenExpiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(signatureFields).values({
      id: "field_link",
      publicId: "field_pub_link",
      documentId: "doc_link",
      fieldType: "payment",
      label: "Pay",
      x: 1,
      y: 1,
      width: 10,
      height: 4,
      page: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(paymentFieldConfigs).values({
      id: "cfg_link",
      publicId: "cfg_pub_link",
      fieldId: "field_link",
      documentId: "doc_link",
      organizationId: "org_link",
      paymentType: "one_time",
      items: "[]",
      currency: "usd",
      dueDateTerms: "on_receipt",
      allowedPaymentMethods: "[]",
      feeHandling: "merchant",
      totalAmountCents: 2500,
      hostedInvoiceUrl: "https://pay.vortex.nyc/example",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = createApp();
    const response = await app.fetch(
      new Request(
        `http://localhost:8787/api/public/signing/${token}/payment-configs`
      ),
      env
    );
    expect(response.status).toBe(200);
    const body = z
      .array(z.object({ hostedInvoiceUrl: z.string().nullable() }))
      .parse(await response.json());
    expect(body[0]?.hostedInvoiceUrl).toBe("https://pay.vortex.nyc/example");
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

  it("writes a signatures row on typed envelope submit", async () => {
    const db = createD1(env.D1);

    await db.insert(organization).values({
      id: "org_sign",
      name: "Sign Org",
      slug: "sign-org",
      metadata: ANONYMOUS_SIGN_ORG_METADATA,
    });

    await db.insert(documents).values({
      id: "doc_sign",
      publicId: "doc_pub_sign",
      organizationId: "org_sign",
      name: "Sign Document",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = "sign-token-type";
    await db.insert(recipients).values({
      id: "rec_sign",
      publicId: "rec_pub_sign",
      documentId: "doc_sign",
      email: "signer@example.com",
      name: "Typed Signer",
      role: "signer",
      status: "pending",
      signingToken: token,
      tokenExpiresAt: new Date(Date.now() + 60_000),
      ...consentFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(webhooks).values({
      id: "hook_sign",
      publicId: "hook_pub_sign",
      organizationId: "org_sign",
      name: "Agree.com probe",
      url: "https://example.com/hooks/seal",
      events: JSON.stringify(["recipient.signed", "document.completed"]),
      secret: "test-secret",
      status: "active",
    });

    const app = createApp();
    const viewed = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "viewed",
          ipAddress: "203.0.113.10",
          userAgent: "seal-test/1.0",
        }),
      }),
      env
    );
    expect(viewed.status).toBe(200);

    const signed = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "signed",
          signatureData: "Typed Signer",
          signatureType: "type",
          ipAddress: "203.0.113.10",
          userAgent: "seal-test/1.0",
        }),
      }),
      env
    );
    expect(signed.status).toBe(200);
    expect(await signed.json()).toEqual({ success: true });

    const rows = await db.select().from(signatures);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.documentId).toBe("doc_sign");
    expect(rows[0]?.recipientId).toBe("rec_sign");
    expect(rows[0]?.value).toBe("Typed Signer");
    expect(rows[0]?.signatureMethod).toBe("type");

    const audits = await db.select().from(auditLogs);
    expect(audits.map((a) => a.action).sort()).toEqual([
      "document.completed",
      "recipient.signed",
      "recipient.viewed",
    ]);

    const activityRows = await db.select().from(activity);
    expect(activityRows.map((a) => a.action).sort()).toEqual([
      "document.completed",
      "recipient.signed",
    ]);

    // SEA-64 reopen: public-submit must enqueue webhook deliveries (not
    // waitUntil fire-and-forget with zero rows).
    const deliveries = await db.select().from(webhookDeliveries);
    expect(deliveries.map((d) => d.eventType).sort()).toEqual([
      "document.completed",
      "recipient.signed",
    ]);
  });

  it("enqueues recipient.viewed and document.viewed webhooks on viewed submit", async () => {
    const db = createD1(env.D1);

    await db.insert(organization).values({
      id: "org_viewed_hook",
      name: "Viewed Hook Org",
      slug: "viewed-hook-org",
      metadata: ANONYMOUS_SIGN_ORG_METADATA,
    });

    await db.insert(documents).values({
      id: "doc_viewed_hook",
      publicId: "doc_pub_viewed_hook",
      organizationId: "org_viewed_hook",
      name: "Viewed Hook Document",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = "viewed-hook-token";
    await db.insert(recipients).values({
      id: "rec_viewed_hook",
      publicId: "rec_pub_viewed_hook",
      documentId: "doc_viewed_hook",
      email: "viewer@example.com",
      name: "Viewer",
      role: "signer",
      status: "pending",
      signingToken: token,
      tokenExpiresAt: new Date(Date.now() + 60_000),
      ...consentFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(webhooks).values({
      id: "hook_viewed",
      publicId: "hook_pub_viewed",
      organizationId: "org_viewed_hook",
      name: "Viewed probe",
      url: "https://example.com/hooks/viewed",
      events: JSON.stringify(["recipient.viewed", "document.viewed"]),
      secret: "test-secret",
      status: "active",
    });

    const app = createApp();
    const viewed = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "viewed",
          ipAddress: "203.0.113.10",
          userAgent: "seal-test/1.0",
        }),
      }),
      env
    );
    expect(viewed.status).toBe(200);

    const deliveries = await db.select().from(webhookDeliveries);
    expect(deliveries.map((d) => d.eventType).sort()).toEqual([
      "document.viewed",
      "recipient.viewed",
    ]);
  });

  it("waits for payment after the last signature instead of completing", async () => {
    const db = createD1(env.D1);
    await db.insert(organization).values({
      id: "org_pay",
      name: "Pay Org",
      slug: "pay-org",
      metadata: ANONYMOUS_SIGN_ORG_METADATA,
    });
    await db.insert(documents).values({
      id: "doc_pay",
      publicId: "doc_pub_pay",
      organizationId: "org_pay",
      name: "Pay Document",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const token = "pay-token";
    await db.insert(recipients).values({
      id: "rec_pay",
      publicId: "rec_pub_pay",
      documentId: "doc_pay",
      email: "payer@example.com",
      name: "Payer",
      role: "signer",
      status: "pending",
      signingToken: token,
      tokenExpiresAt: new Date(Date.now() + 60_000),
      ...consentFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(signatureFields).values({
      id: "field_pay",
      publicId: "field_pub_pay",
      documentId: "doc_pay",
      recipientId: "rec_pay",
      fieldType: "payment",
      label: "Pay",
      isRequired: true,
      x: 10,
      y: 10,
      width: 20,
      height: 8,
      page: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(paymentFieldConfigs).values({
      id: "cfg_pay",
      publicId: "cfg_pub_pay",
      fieldId: "field_pay",
      documentId: "doc_pay",
      organizationId: "org_pay",
      paymentType: "one_time",
      items: "[]",
      currency: "usd",
      dueDateTerms: "on_receipt",
      allowedPaymentMethods: "[]",
      feeHandling: "merchant",
      totalAmountCents: 2500,
      paymentStatus: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = createApp();
    const signed = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "signed",
          signatureData: "Payer",
          signatureType: "type",
          ipAddress: "203.0.113.10",
          userAgent: "seal-test/1.0",
        }),
      }),
      env
    );
    expect(signed.status).toBe(200);

    const [doc] = await db
      .select({ status: documents.status })
      .from(documents)
      .where(eq(documents.id, "doc_pay"));
    expect(doc?.status).toBe("waiting_for_payment");

    const audits = await db.select().from(auditLogs);
    expect(audits.map((row) => row.action)).not.toContain("document.completed");
  });

  it("rejects a second terminal submit (first-writer-wins)", async () => {
    const db = createD1(env.D1);

    await db.insert(organization).values({
      id: "org_race",
      name: "Race Org",
      slug: "race-org",
      metadata: ANONYMOUS_SIGN_ORG_METADATA,
    });

    await db.insert(documents).values({
      id: "doc_race",
      publicId: "doc_pub_race",
      organizationId: "org_race",
      name: "Race Document",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = "sign-token-race";
    await db.insert(recipients).values([
      {
        id: "rec_race",
        publicId: "rec_pub_race",
        documentId: "doc_race",
        email: "race@example.com",
        name: "Race Signer",
        role: "signer",
        order: 0,
        status: "pending",
        signingToken: token,
        tokenExpiresAt: new Date(Date.now() + 60_000),
        ...consentFields,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "rec_race_other",
        publicId: "rec_pub_race_other",
        documentId: "doc_race",
        email: "other@example.com",
        name: "Other Signer",
        role: "signer",
        order: 1,
        status: "pending",
        signingToken: "sign-token-other",
        tokenExpiresAt: new Date(Date.now() + 60_000),
        ...consentFields,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const app = createApp();
    const body = {
      status: "signed",
      signatureData: "Race Signer",
      signatureType: "type",
      ipAddress: "203.0.113.20",
      userAgent: "seal-test/1.0",
    };

    const first = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      env
    );
    expect(first.status).toBe(200);

    const second = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      env
    );
    expect(second.status).toBe(403);
    expect(await second.json()).toEqual({
      error: "Recipient has already completed",
    });

    expect(await db.select().from(signatures)).toHaveLength(1);
    const signedAudits = (await db.select().from(auditLogs)).filter(
      (a) => a.action === "recipient.signed"
    );
    expect(signedAudits).toHaveLength(1);
  });

  it("blocks submit until access code is verified", async () => {
    const db = createD1(env.D1);
    const { hashAccessCode } = await import("../platform/signer-auth.js");

    await db.insert(organization).values({
      id: "org_auth",
      name: "Auth Org",
      slug: "auth-org",
      metadata: ANONYMOUS_SIGN_ORG_METADATA,
    });
    await db.insert(documents).values({
      id: "doc_auth",
      publicId: "doc_pub_auth",
      organizationId: "org_auth",
      name: "Auth Document",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = "sign-token-auth";
    await db.insert(recipients).values({
      id: "rec_auth",
      publicId: "rec_pub_auth",
      documentId: "doc_auth",
      email: "auth@example.com",
      name: "Auth Signer",
      role: "signer",
      status: "pending",
      signingToken: token,
      tokenExpiresAt: new Date(Date.now() + 60_000),
      authMethod: "access_code",
      accessCodeHash: await hashAccessCode("pass-1234"),
      ...consentFields,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = createApp();
    const blocked = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "signed",
          signatureData: "Auth Signer",
          signatureType: "type",
          ipAddress: "203.0.113.30",
          userAgent: "seal-test/1.0",
        }),
      }),
      env
    );
    expect(blocked.status).toBe(403);

    const verified = await app.fetch(
      new Request(
        `http://localhost:8787/api/public/signing/${token}/auth/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "pass-1234" }),
        }
      ),
      env
    );
    expect(verified.status).toBe(200);

    const signed = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "signed",
          signatureData: "Auth Signer",
          signatureType: "type",
          ipAddress: "203.0.113.30",
          userAgent: "seal-test/1.0",
        }),
      }),
      env
    );
    expect(signed.status).toBe(200);
  });

  it("records privacy notice and gates submit until acknowledged", async () => {
    const db = createD1(env.D1);

    await db.insert(organization).values({
      id: "org_privacy",
      name: "Privacy Org",
      slug: "privacy-org",
    });
    await db.insert(documents).values({
      id: "doc_privacy",
      publicId: "doc_pub_privacy",
      organizationId: "org_privacy",
      name: "Privacy Document",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = "sign-token-privacy";
    await db.insert(recipients).values({
      id: "rec_privacy",
      publicId: "rec_pub_privacy",
      documentId: "doc_privacy",
      email: "privacy@example.com",
      name: "Privacy Signer",
      role: "signer",
      status: "pending",
      signingToken: token,
      tokenExpiresAt: new Date(Date.now() + 60_000),
      esignConsentAt: new Date(),
      esignConsentIp: "203.0.113.40",
      esignConsentVersion: "seal-esign-1",
      esignConsentTextHash: "sha256:consent-test",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = createApp();
    const blocked = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "viewed",
          ipAddress: "203.0.113.40",
          userAgent: "seal-test/1.0",
        }),
      }),
      env
    );
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({
      error: "Privacy notice acknowledgment required",
    });

    const ack = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/privacy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: "203.0.113.40",
          userAgent: "seal-test/1.0",
        }),
      }),
      env
    );
    expect(ack.status).toBe(200);
    const ackBody = z
      .object({
        success: z.literal(true),
        acknowledgedAt: z.number(),
        noticeVersion: z.string(),
        noticeTextHash: z.string(),
      })
      .parse(await ack.json());
    expect(ackBody.noticeVersion).toBe("seal-privacy-1");
    expect(ackBody.noticeTextHash.startsWith("sha256:")).toBe(true);

    const viewed = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "viewed",
          ipAddress: "203.0.113.40",
          userAgent: "seal-test/1.0",
        }),
      }),
      env
    );
    expect(viewed.status).toBe(200);

    const audits = await db.select().from(auditLogs);
    expect(audits.some((a) => a.action === "recipient.privacy_notice")).toBe(
      true
    );
  });

  it("records ESIGN opt-out with audit evidence (SEA-58)", async () => {
    const db = createD1(env.D1);

    await db.insert(organization).values({
      id: "org_optout",
      name: "OptOut Org",
      slug: "optout-org",
    });
    await db.insert(documents).values({
      id: "doc_optout",
      publicId: "doc_pub_optout",
      organizationId: "org_optout",
      name: "OptOut Document",
      status: "sent",
      documentStatus: "active",
      sharingMode: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = "sign-token-optout";
    await db.insert(recipients).values({
      id: "rec_optout",
      publicId: "rec_pub_optout",
      documentId: "doc_optout",
      email: "optout@example.com",
      name: "OptOut Signer",
      role: "signer",
      status: "pending",
      signingToken: token,
      tokenExpiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const app = createApp();
    const res = await app.fetch(
      new Request(`http://localhost:8787/api/public/signing/${token}/opt-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress: "203.0.113.50",
          userAgent: "seal-test/1.0",
          method: "paper_copy_request",
        }),
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = z
      .object({
        success: z.literal(true),
        optedOutAt: z.number(),
        method: z.literal("paper_copy_request"),
      })
      .parse(await res.json());
    expect(body.optedOutAt).toBeGreaterThan(0);

    const [row] = await db
      .select()
      .from(recipients)
      .where(eq(recipients.id, "rec_optout"));
    expect(row?.esignOptOutAt).toBeTruthy();
    expect(row?.esignOptOutMethod).toBe("paper_copy_request");
    expect(row?.esignOptOutIp).toBe("203.0.113.50");

    const audits = await db.select().from(auditLogs);
    expect(audits.some((a) => a.action === "recipient.esign_opt_out")).toBe(
      true
    );

    const activityRows = await db.select().from(activity);
    expect(
      activityRows.some((a) => a.action === "recipient.esign_opt_out")
    ).toBe(true);
  });
});
