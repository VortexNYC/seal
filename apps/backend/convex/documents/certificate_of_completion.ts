/**
 * Certificate of Completion Generator
 *
 * Generates a PDF certificate when a document is fully signed.
 * ESIGN Act compliance: provides proof of signing for all parties.
 *
 * Includes:
 * - Document details (name, ID, page count)
 * - All signers with timestamps and signature methods
 * - Document hash (SHA-256) for integrity verification
 * - Chronological audit trail timeline
 */

import { ConvexError, v } from "convex/values";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { encode as encodeQr } from "uqr";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const QR_SIZE = 72; // points (1 inch)
const QR_CAPTION = "Scan to verify";

interface CertificateData {
  document: Doc<"documents">;
  recipients: Doc<"document_recipients">[];
  auditLogs: Doc<"audit_logs">[];
  documentHash?: string;
  qrToken?: string;
  verifyBaseUrl: string;
}

/**
 * Generate the certificate PDF bytes
 */
async function generateCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const addNewPageIfNeeded = (requiredSpace: number) => {
    if (y - requiredSpace < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  // --- Header ---
  page.drawText("CERTIFICATE OF COMPLETION", {
    x: MARGIN,
    y,
    size: 18,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 30;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 2,
    color: rgb(0.16, 0.5, 0.35), // Seal brand green
  });
  y -= 25;

  // --- Document Details ---
  page.drawText("Document Details", {
    x: MARGIN,
    y,
    size: 13,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  const details = [
    ["Document Name:", data.document.name],
    ["Document ID:", data.document._id],
    ["Status:", "Completed"],
    [
      "Created:",
      new Date(data.document._creationTime).toLocaleString("en-US", { timeZone: "UTC" }),
    ],
    [
      "Completed:",
      data.document.completedAt
        ? new Date(data.document.completedAt).toLocaleString("en-US", { timeZone: "UTC" })
        : "N/A",
    ],
    ["Page Count:", String(data.document.pageCount ?? "N/A")],
    ["Document Hash (SHA-256):", data.documentHash ?? "Not available"],
  ];

  for (const [label, value] of details) {
    addNewPageIfNeeded(16);
    page.drawText(label, {
      x: MARGIN,
      y,
      size: 9,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    page.drawText(String(value), {
      x: MARGIN + 160,
      y,
      size: 9,
      font: helvetica,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: CONTENT_WIDTH - 160,
    });
    y -= 16;
  }

  y -= 15;

  // --- Signers ---
  addNewPageIfNeeded(40);
  page.drawText("Signers & Recipients", {
    x: MARGIN,
    y,
    size: 13,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  for (const recipient of data.recipients) {
    addNewPageIfNeeded(70);

    page.drawText(`${recipient.name || recipient.email}`, {
      x: MARGIN,
      y,
      size: 10,
      font: helveticaBold,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 14;

    page.drawText(`Email: ${recipient.email}`, {
      x: MARGIN + 10,
      y,
      size: 9,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 13;

    page.drawText(`Role: ${recipient.role.charAt(0).toUpperCase() + recipient.role.slice(1)}`, {
      x: MARGIN + 10,
      y,
      size: 9,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 13;

    page.drawText(`Status: ${recipient.status}`, {
      x: MARGIN + 10,
      y,
      size: 9,
      font: helvetica,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 13;

    const completedAt = recipient.signedAt || recipient.approvedAt || recipient.viewedAt;
    if (completedAt) {
      page.drawText(
        `Completed: ${new Date(completedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC`,
        {
          x: MARGIN + 10,
          y,
          size: 9,
          font: helvetica,
          color: rgb(0.3, 0.3, 0.3),
        },
      );
      y -= 13;
    }

    y -= 8;
  }

  y -= 10;

  // --- Audit Timeline ---
  addNewPageIfNeeded(40);
  page.drawText("Audit Trail Timeline", {
    x: MARGIN,
    y,
    size: 13,
    font: helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;

  // Sort audit logs chronologically
  const sortedLogs = [...data.auditLogs].sort((a, b) => a.createdAt - b.createdAt);

  for (const log of sortedLogs) {
    addNewPageIfNeeded(28);

    const timestamp = new Date(log.createdAt).toLocaleString("en-US", { timeZone: "UTC" });
    const actionLabel = log.action.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    page.drawText(`${timestamp} UTC`, {
      x: MARGIN,
      y,
      size: 8,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });

    page.drawText(actionLabel, {
      x: MARGIN + 160,
      y,
      size: 8,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    if (log.ipAddress && log.ipAddress !== "unknown") {
      page.drawText(`IP: ${log.ipAddress}`, {
        x: MARGIN + 350,
        y,
        size: 7,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    y -= 14;
  }

  y -= 20;

  // --- Footer ---
  addNewPageIfNeeded(60);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 20;

  page.drawText("This certificate was automatically generated by Seal.", {
    x: MARGIN,
    y,
    size: 8,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 12;

  page.drawText(`Generated: ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC`, {
    x: MARGIN,
    y,
    size: 8,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 12;

  page.drawText(
    "Verify document integrity by comparing the Document Hash above with the original document.",
    {
      x: MARGIN,
      y,
      size: 7,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
    },
  );

  // --- QR Code (bottom-right corner of first page) ---
  if (data.qrToken) {
    const verifyUrl = `${data.verifyBaseUrl}/verify/${data.qrToken}`;
    const qr = encodeQr(verifyUrl, { ecc: "Q" });
    const firstPage = pdfDoc.getPage(0);
    const moduleSize = QR_SIZE / qr.size;
    // Quiet zone: 4 modules of white padding
    const quietZone = 4 * moduleSize;
    const totalSize = QR_SIZE + quietZone * 2;
    const qrX = PAGE_WIDTH - MARGIN - totalSize;
    const qrY = MARGIN + 12; // caption height offset

    // White background (quiet zone)
    firstPage.drawRectangle({
      x: qrX,
      y: qrY,
      width: totalSize,
      height: totalSize,
      color: rgb(1, 1, 1),
    });

    // Draw QR modules
    for (let row = 0; row < qr.size; row++) {
      for (let col = 0; col < qr.size; col++) {
        if (qr.data[row * qr.size + col]) {
          firstPage.drawRectangle({
            x: qrX + quietZone + col * moduleSize,
            y: qrY + quietZone + (qr.size - 1 - row) * moduleSize, // flip Y axis (PDF origin is bottom-left)
            width: moduleSize,
            height: moduleSize,
            color: rgb(0, 0, 0),
          });
        }
      }
    }

    // Caption below QR
    const captionWidth = helvetica.widthOfTextAtSize(QR_CAPTION, 7);
    firstPage.drawText(QR_CAPTION, {
      x: qrX + (totalSize - captionWidth) / 2,
      y: MARGIN,
      size: 7,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  return pdfDoc.save();
}

/**
 * Store the certificate PDF in Convex Storage and update the document record.
 */
export const storeCertificate = internalMutation({
  args: {
    documentId: v.id("documents"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      certificateStorageId: args.storageId,
    });
  },
});

/**
 * Fetch all data needed for the certificate and generate it.
 */
export const generateCertificate = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<{ storageId: string }> => {
    // 1. Get document
    const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
      documentId: args.documentId,
    });

    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 2. Get recipients
    const recipients = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId },
    );

    // 3. Get audit trail
    const auditLogs = await ctx.runQuery(
      internal.audit_logs.queries.getDocumentAuditTrailInternal,
      {
        documentId: args.documentId,
      },
    );

    // 4. Generate PDF
    const pdfBytes = await generateCertificatePdf({
      document,
      recipients,
      auditLogs,
      documentHash: document.documentHash ?? undefined,
      qrToken: document.qrToken ?? undefined,
      verifyBaseUrl: process.env.SITE_URL ?? "https://app.seal.so",
    });

    // 5. Upload to Convex Storage
    const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
    const storageId = await ctx.storage.store(blob);

    // 6. Store reference on the document
    await ctx.runMutation(internal.documents.certificate_of_completion.storeCertificate, {
      documentId: args.documentId,
      storageId,
    });

    return { storageId };
  },
});
