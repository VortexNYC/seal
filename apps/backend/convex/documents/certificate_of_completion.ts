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
import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from "pdf-lib";
import { encode as encodeQr } from "uqr";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { internalAction, internalMutation } from "../_generated/server";
import { applyRedaction, type RedactionLevel } from "./redaction";

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
  redactionLevel?: RedactionLevel;
}

interface CertificatePageState {
  pdfDoc: PDFDocument;
  page: PDFPage;
  y: number;
  helvetica: PDFFont;
  helveticaBold: PDFFont;
}

function addNewPageIfNeeded(state: CertificatePageState, requiredSpace: number): void {
  if (state.y - requiredSpace < MARGIN) {
    state.page = state.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    state.y = PAGE_HEIGHT - MARGIN;
  }
}

function drawHeader(state: CertificatePageState): void {
  state.page.drawText("CERTIFICATE OF COMPLETION", {
    x: MARGIN,
    y: state.y,
    size: 18,
    font: state.helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  state.y -= 30;

  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: PAGE_WIDTH - MARGIN, y: state.y },
    thickness: 2,
    color: rgb(0.16, 0.5, 0.35),
  });
  state.y -= 25;
}

function drawDocumentDetails(state: CertificatePageState, data: CertificateData): void {
  state.page.drawText("Document Details", {
    x: MARGIN,
    y: state.y,
    size: 13,
    font: state.helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  state.y -= 20;

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
    addNewPageIfNeeded(state, 16);
    state.page.drawText(label, {
      x: MARGIN,
      y: state.y,
      size: 9,
      font: state.helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    state.page.drawText(String(value), {
      x: MARGIN + 160,
      y: state.y,
      size: 9,
      font: state.helvetica,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: CONTENT_WIDTH - 160,
    });
    state.y -= 16;
  }

  state.y -= 15;
}

function drawRecipientsSection(
  state: CertificatePageState,
  recipients: Doc<"document_recipients">[],
  redactionLevel?: RedactionLevel,
): void {
  addNewPageIfNeeded(state, 40);
  state.page.drawText("Signers & Recipients", {
    x: MARGIN,
    y: state.y,
    size: 13,
    font: state.helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  state.y -= 20;

  for (const recipient of recipients) {
    addNewPageIfNeeded(state, 70);

    state.page.drawText(`${recipient.name || recipient.email}`, {
      x: MARGIN,
      y: state.y,
      size: 10,
      font: state.helveticaBold,
      color: rgb(0.15, 0.15, 0.15),
    });
    state.y -= 14;

    const maskedEmail = applyRedaction(recipient.email, "email", redactionLevel);
    const details: string[] = [
      `Email: ${maskedEmail}`,
      `Role: ${recipient.role.charAt(0).toUpperCase() + recipient.role.slice(1)}`,
      `Status: ${recipient.status}`,
    ];

    if (recipient.phone) {
      const maskedPhone = applyRedaction(recipient.phone, "phone", redactionLevel);
      details.push(`Phone: ${maskedPhone}`);
    }

    for (const detail of details) {
      state.page.drawText(detail, {
        x: MARGIN + 10,
        y: state.y,
        size: 9,
        font: state.helvetica,
        color: rgb(0.3, 0.3, 0.3),
      });
      state.y -= 13;
    }

    const completedAt = recipient.signedAt || recipient.approvedAt || recipient.viewedAt;
    if (completedAt) {
      state.page.drawText(
        `Completed: ${new Date(completedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC`,
        {
          x: MARGIN + 10,
          y: state.y,
          size: 9,
          font: state.helvetica,
          color: rgb(0.3, 0.3, 0.3),
        },
      );
      state.y -= 13;
    }

    state.y -= 8;
  }

  state.y -= 10;
}

function drawAuditTrail(state: CertificatePageState, auditLogs: Doc<"audit_logs">[]): void {
  addNewPageIfNeeded(state, 40);
  state.page.drawText("Audit Trail Timeline", {
    x: MARGIN,
    y: state.y,
    size: 13,
    font: state.helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  state.y -= 20;

  const sortedLogs = [...auditLogs].sort((left, right) => left.createdAt - right.createdAt);

  for (const log of sortedLogs) {
    addNewPageIfNeeded(state, 28);

    const timestamp = new Date(log.createdAt).toLocaleString("en-US", { timeZone: "UTC" });
    const actionLabel = log.action
      .replace(/\./g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    state.page.drawText(`${timestamp} UTC`, {
      x: MARGIN,
      y: state.y,
      size: 8,
      font: state.helvetica,
      color: rgb(0.4, 0.4, 0.4),
    });

    state.page.drawText(actionLabel, {
      x: MARGIN + 160,
      y: state.y,
      size: 8,
      font: state.helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    if (log.ipAddress && log.ipAddress !== "unknown") {
      state.page.drawText(`IP: ${log.ipAddress}`, {
        x: MARGIN + 350,
        y: state.y,
        size: 7,
        font: state.helvetica,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    state.y -= 14;
  }

  state.y -= 20;
}

function drawFooter(state: CertificatePageState): void {
  addNewPageIfNeeded(state, 60);
  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: PAGE_WIDTH - MARGIN, y: state.y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  state.y -= 20;

  const footerLines = [
    "This certificate was automatically generated by Seal.",
    `Generated: ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC`,
    "Verify document integrity by comparing the Document Hash above with the original document.",
  ];

  footerLines.forEach((line, index) => {
    state.page.drawText(line, {
      x: MARGIN,
      y: state.y,
      size: index === 2 ? 7 : 8,
      font: state.helvetica,
      color: index === 2 ? rgb(0.6, 0.6, 0.6) : rgb(0.5, 0.5, 0.5),
    });
    state.y -= 12;
  });
}

function drawQrCode(pdfDoc: PDFDocument, helvetica: PDFFont, data: CertificateData): void {
  if (!data.qrToken) {
    return;
  }

  const verifyUrl = `${data.verifyBaseUrl}/verify/${data.qrToken}`;
  const qr = encodeQr(verifyUrl, { ecc: "Q" });
  const firstPage = pdfDoc.getPage(0);
  const moduleSize = QR_SIZE / qr.size;
  const quietZone = 4 * moduleSize;
  const totalSize = QR_SIZE + quietZone * 2;
  const qrX = PAGE_WIDTH - MARGIN - totalSize;
  const qrY = MARGIN + 12;

  firstPage.drawRectangle({
    x: qrX,
    y: qrY,
    width: totalSize,
    height: totalSize,
    color: rgb(1, 1, 1),
  });

  for (let row = 0; row < qr.size; row++) {
    for (let col = 0; col < qr.size; col++) {
      if (!qr.data[row * qr.size + col]) {
        continue;
      }

      firstPage.drawRectangle({
        x: qrX + quietZone + col * moduleSize,
        y: qrY + quietZone + (qr.size - 1 - row) * moduleSize,
        width: moduleSize,
        height: moduleSize,
        color: rgb(0, 0, 0),
      });
    }
  }

  const captionWidth = helvetica.widthOfTextAtSize(QR_CAPTION, 7);
  firstPage.drawText(QR_CAPTION, {
    x: qrX + (totalSize - captionWidth) / 2,
    y: MARGIN,
    size: 7,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });
}

/**
 * Generate the certificate PDF bytes
 */
async function generateCertificatePdf(data: CertificateData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const state: CertificatePageState = {
    pdfDoc,
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
    helvetica,
    helveticaBold,
  };

  drawHeader(state);
  drawDocumentDetails(state, data);
  drawRecipientsSection(state, data.recipients, data.redactionLevel);
  drawAuditTrail(state, data.auditLogs);
  drawFooter(state);
  drawQrCode(pdfDoc, helvetica, data);

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
      redactionLevel: document.redactionLevel as RedactionLevel | undefined,
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
