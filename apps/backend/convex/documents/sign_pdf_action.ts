/**
 * PDF Signing Action
 *
 * Embeds signature images and data into PDFs and creates signed versions.
 * The cryptographic integrity is maintained through signature hashes stored
 * in the database (see signatures schema).
 *
 * SEA-108: Digital Signature Implementation
 *
 * Note: Full PDF/A digital signatures with embedded certificates require
 * additional setup (certificate authority, HSM integration). For now, we
 * embed signature images and maintain cryptographic hashes in the database.
 */

import { ConvexError, v } from "convex/values";
import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";

import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, type ActionCtx } from "../_generated/server";
import { isRecipientComplete } from "../schemas/document_recipients";

type PdfSigningBundle = {
  document: Doc<"documents">;
  signatures: Doc<"signatures">[];
  signatureFields: Doc<"signature_fields">[];
  recipients: Doc<"document_recipients">[];
  pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  helvetica: PDFFont;
  helveticaBold: PDFFont;
};

type SignatureStampLayout = {
  x: number;
  width: number;
  height: number;
  pdfY: number;
  signatureAreaHeight: number;
  stampHeight: number;
};

async function loadSigningPdfBundle(
  ctx: ActionCtx,
  documentId: Id<"documents">
): Promise<PdfSigningBundle> {
  const document: Doc<"documents"> | null = await ctx.runQuery(
    internal.documents.queries.getDocumentInternal,
    { documentId }
  );
  if (!document) {
    throw new ConvexError("Document not found");
  }

  const signatures: Doc<"signatures">[] = await ctx.runQuery(
    internal.signatures.queries.getDecryptedSignaturesByDocumentInternal,
    { documentId }
  );
  if (signatures.length === 0) {
    throw new ConvexError("No signatures found for this document");
  }

  const pdfUrl = await ctx.storage.getUrl(document.storageId);
  if (!pdfUrl) {
    throw new ConvexError("PDF file not found in storage");
  }

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new ConvexError("Failed to download PDF");
  }

  const pdfDoc = await PDFDocument.load(await response.arrayBuffer());
  const signatureFields: Doc<"signature_fields">[] = await ctx.runQuery(
    internal.signature_fields.queries.getFieldsByDocumentInternal,
    { documentId }
  );
  const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
    internal.documents.recipients_queries.getDocumentRecipientsInternal,
    { documentId }
  );

  return {
    document,
    signatures,
    signatureFields,
    recipients,
    pdfDoc,
    helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    helveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

async function saveSignedPdfToStorage(
  ctx: ActionCtx,
  pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>
): Promise<string> {
  const signedPdfBytes = await pdfDoc.save();
  const signedBlob = new Blob([new Uint8Array(signedPdfBytes)], {
    type: "application/pdf",
  });
  return await ctx.storage.store(signedBlob);
}

/**
 * Embed signature images and data into a PDF
 * Creates a "signed" PDF with all signatures rendered as images
 */
export const signPdfDocument = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; signedStorageId: string }> => {
    const signingBundle = await loadSigningPdfBundle(ctx, args.documentId);
    await embedSignaturesIntoPdf(
      signingBundle.pdfDoc,
      signingBundle.document,
      signingBundle.signatures,
      signingBundle.signatureFields,
      signingBundle.recipients,
      signingBundle.helvetica,
      signingBundle.helveticaBold
    );
    const signedStorageId = await saveSignedPdfToStorage(
      ctx,
      signingBundle.pdfDoc
    );

    await ctx.runMutation(internal.documents.mutations.updateSignedStorageId, {
      documentId: args.documentId,
      signedStorageId,
    });

    return { success: true, signedStorageId };
  },
});

/**
 * Get URL for the signed PDF
 */
export const getSignedPdfUrl = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId }
    );

    if (!document || !document.signedStorageId) {
      return null;
    }

    const url = await ctx.storage.getUrl(document.signedStorageId);
    return url;
  },
});

/**
 * Get both original and signed PDF URLs
 */
export const getDocumentPdfUrls = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    originalUrl: string | null;
    signedUrl: string | null;
    hasSignedVersion: boolean;
    documentName: string;
  }> => {
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId }
    );

    if (!document) {
      throw new ConvexError("Document not found");
    }

    const originalUrl = await ctx.storage.getUrl(document.storageId);
    const signedUrl = document.signedStorageId
      ? await ctx.storage.getUrl(document.signedStorageId)
      : null;

    return {
      originalUrl,
      signedUrl,
      hasSignedVersion: !!document.signedStorageId,
      documentName: document.name,
    };
  },
});

/**
 * Check if a document has been signed (has signatures)
 */
export const checkDocumentSigningStatus = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    hasSignatures: boolean;
    signatureCount: number;
    hasSignedPdf: boolean;
    documentHash: string | null;
  }> => {
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId }
    );

    if (!document) {
      throw new ConvexError("Document not found");
    }

    const signatures: Doc<"signatures">[] = await ctx.runQuery(
      internal.signatures.queries.getSignaturesByDocumentInternal,
      { documentId: args.documentId }
    );

    return {
      hasSignatures: signatures.length > 0,
      signatureCount: signatures.length,
      hasSignedPdf: !!document.signedStorageId,
      documentHash: document.documentHash ?? null,
    };
  },
});

/**
 * Signature stamp configuration
 */
const stampConfig = {
  bgColor: rgb(0.98, 0.98, 0.98),
  borderColor: rgb(0.85, 0.85, 0.85),
  labelColor: rgb(0.4, 0.4, 0.4),
  valueColor: rgb(0.15, 0.15, 0.15),
  accentColor: rgb(0.13, 0.55, 0.13), // Green accent for "Signed"
  fontSize: {
    label: 6,
    value: 7,
    signed: 7,
  },
  padding: 4,
  lineHeight: 9,
};

function getSignatureStampLayout(
  page: PDFPage,
  field: Doc<"signature_fields">
): SignatureStampLayout {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const x = (field.x / 100) * pageWidth;
  const y = (field.y / 100) * pageHeight;
  const width = (field.width / 100) * pageWidth;
  const height = (field.height / 100) * pageHeight;
  const stampHeight = 36;

  return {
    x,
    width,
    height,
    pdfY: pageHeight - y - height,
    signatureAreaHeight: height - stampHeight,
    stampHeight,
  };
}

function formatSignedAt(signedAt: number): {
  dateStr: string;
  timeStr: string;
} {
  const signedDate = new Date(signedAt);
  return {
    dateStr: signedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    timeStr: signedDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

function drawSignatureFrame(page: PDFPage, layout: SignatureStampLayout): void {
  page.drawRectangle({
    x: layout.x,
    y: layout.pdfY,
    width: layout.width,
    height: layout.height,
    color: stampConfig.bgColor,
    borderColor: stampConfig.borderColor,
    borderWidth: 0.5,
  });

  page.drawLine({
    start: { x: layout.x + 2, y: layout.pdfY + layout.stampHeight },
    end: {
      x: layout.x + layout.width - 2,
      y: layout.pdfY + layout.stampHeight,
    },
    thickness: 0.5,
    color: stampConfig.borderColor,
  });
}

async function embedImageBytes(
  pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>,
  imageBytes: Uint8Array,
  prefersPng: boolean
) {
  if (prefersPng) {
    return await pdfDoc.embedPng(imageBytes);
  }

  try {
    return await pdfDoc.embedJpg(imageBytes);
  } catch {
    return await pdfDoc.embedPng(imageBytes);
  }
}

async function loadEmbeddedSignatureImage(
  pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>,
  signatureImageUrl: string
) {
  try {
    if (signatureImageUrl.startsWith("data:image/")) {
      const base64Data = signatureImageUrl.split(",")[1];
      if (!base64Data) {
        return null;
      }

      const imageBytes = Uint8Array.from(atob(base64Data), (char) =>
        char.charCodeAt(0)
      );
      return await embedImageBytes(
        pdfDoc,
        imageBytes,
        signatureImageUrl.includes("data:image/png")
      );
    }

    const response = await fetch(signatureImageUrl);
    if (!response.ok) {
      return null;
    }

    const imageBytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "";
    return await embedImageBytes(
      pdfDoc,
      imageBytes,
      contentType.includes("png")
    );
  } catch (error) {
    console.error("Failed to embed signature image:", error);
    return null;
  }
}

async function drawSignatureImage(
  page: PDFPage,
  pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>,
  signatureImageUrl: string,
  layout: SignatureStampLayout
): Promise<void> {
  const embeddedImage = await loadEmbeddedSignatureImage(
    pdfDoc,
    signatureImageUrl
  );
  if (!embeddedImage) {
    return;
  }

  const imageDimensions = embeddedImage.scaleToFit(
    layout.width - 10,
    layout.signatureAreaHeight - 6
  );
  page.drawImage(embeddedImage, {
    x: layout.x + (layout.width - imageDimensions.width) / 2,
    y:
      layout.pdfY +
      layout.stampHeight +
      (layout.signatureAreaHeight - imageDimensions.height) / 2,
    width: imageDimensions.width,
    height: imageDimensions.height,
  });
}

function drawTypedSignatureText(
  page: PDFPage,
  signatureValue: string,
  layout: SignatureStampLayout,
  helveticaBold: PDFFont
): void {
  const fontSize = Math.min(layout.signatureAreaHeight * 0.5, 20);
  const textWidth = helveticaBold.widthOfTextAtSize(signatureValue, fontSize);

  page.drawText(signatureValue, {
    x: layout.x + (layout.width - textWidth) / 2,
    y:
      layout.pdfY +
      layout.stampHeight +
      layout.signatureAreaHeight / 2 -
      fontSize / 3,
    size: fontSize,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.3),
  });
}

function drawSignatureStampDetails(
  page: PDFPage,
  signerName: string,
  signerEmail: string,
  signedAt: { dateStr: string; timeStr: string },
  layout: SignatureStampLayout,
  helvetica: PDFFont,
  helveticaBold: PDFFont
): void {
  const stampX = layout.x + stampConfig.padding;
  let stampY = layout.pdfY + layout.stampHeight - stampConfig.padding - 2;

  page.drawText("Signed by:", {
    x: stampX,
    y: stampY,
    size: stampConfig.fontSize.label,
    font: helvetica,
    color: stampConfig.labelColor,
  });

  const signedByLabelWidth = helvetica.widthOfTextAtSize(
    "Signed by: ",
    stampConfig.fontSize.label
  );
  page.drawText(signerName, {
    x: stampX + signedByLabelWidth,
    y: stampY,
    size: stampConfig.fontSize.value,
    font: helveticaBold,
    color: stampConfig.valueColor,
  });

  stampY -= stampConfig.lineHeight;

  if (signerEmail && signerEmail !== signerName) {
    const emailDisplay =
      signerEmail.length > 35
        ? `${signerEmail.substring(0, 32)}...`
        : signerEmail;
    page.drawText(emailDisplay, {
      x: stampX,
      y: stampY,
      size: stampConfig.fontSize.label,
      font: helvetica,
      color: stampConfig.labelColor,
    });
    stampY -= stampConfig.lineHeight;
  }

  page.drawText("Date:", {
    x: stampX,
    y: stampY,
    size: stampConfig.fontSize.label,
    font: helvetica,
    color: stampConfig.labelColor,
  });

  const dateLabelWidth = helvetica.widthOfTextAtSize(
    "Date: ",
    stampConfig.fontSize.label
  );
  page.drawText(`${signedAt.dateStr} at ${signedAt.timeStr}`, {
    x: stampX + dateLabelWidth,
    y: stampY,
    size: stampConfig.fontSize.value,
    font: helvetica,
    color: stampConfig.valueColor,
  });
}

async function drawSignatureStamp(
  page: PDFPage,
  pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>,
  signature: Doc<"signatures">,
  field: Doc<"signature_fields">,
  recipient: Doc<"document_recipients"> | undefined,
  helvetica: PDFFont,
  helveticaBold: PDFFont
): Promise<void> {
  const layout = getSignatureStampLayout(page, field);
  drawSignatureFrame(page, layout);

  if (signature.signatureImageUrl) {
    await drawSignatureImage(page, pdfDoc, signature.signatureImageUrl, layout);
  } else if (signature.value) {
    drawTypedSignatureText(page, signature.value, layout, helveticaBold);
  }

  drawSignatureStampDetails(
    page,
    recipient?.name || recipient?.email || "Unknown",
    recipient?.email || "",
    formatSignedAt(signature.signedAt),
    layout,
    helvetica,
    helveticaBold
  );
}

function addVerificationFooter(
  page: PDFPage,
  document: Doc<"documents">,
  signatures: Doc<"signatures">[],
  helvetica: PDFFont
): void {
  const { width: pageWidth } = page.getSize();
  const footerY = 20;

  page.drawLine({
    start: { x: 50, y: footerY + 15 },
    end: { x: pageWidth - 50, y: footerY + 15 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  const verificationText = `Document signed via Seal | Signatures: ${signatures.length} | Document Hash: ${document.documentHash?.substring(0, 16) || "N/A"}...`;
  const textWidth = helvetica.widthOfTextAtSize(verificationText, 8);
  page.drawText(verificationText, {
    x: (pageWidth - textWidth) / 2,
    y: footerY,
    size: 8,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });
}

/**
 * Embed signatures into a PDF document
 * This is a shared helper used by both signPdfDocument and generateAndGetSignedPdfByToken
 */
async function embedSignaturesIntoPdf(
  pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>,
  document: Doc<"documents">,
  signatures: Doc<"signatures">[],
  signatureFields: Doc<"signature_fields">[],
  recipients: Doc<"document_recipients">[],
  helvetica: PDFFont,
  helveticaBold: PDFFont
): Promise<void> {
  const pages = pdfDoc.getPages();
  const recipientMap = new Map(recipients.map((r) => [r._id, r]));

  for (const signature of signatures) {
    const field = signatureFields.find((f) => f._id === signature.fieldId);
    if (!field) {
      continue;
    }

    const page = pages[field.page - 1];
    if (!page) {
      continue;
    }

    await drawSignatureStamp(
      page,
      pdfDoc,
      signature,
      field,
      recipientMap.get(signature.recipientId),
      helvetica,
      helveticaBold
    );
  }

  const lastPage = pages[pages.length - 1];
  if (lastPage) {
    addVerificationFooter(lastPage, document, signatures, helvetica);
  }
}

/**
 * Generate and get signed PDF by signing token
 * This action is used when downloading a document from the public signing page.
 * It validates the token, generates the signed PDF if needed, and returns the URL.
 */
export const generateAndGetSignedPdfByToken = action({
  args: {
    signingToken: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ url: string; documentName: string }> => {
    // 1. Validate token and get recipient (this validates token expiration as well)
    const { recipient } = await ctx.runQuery(
      api.documents.recipients_queries.getRecipientByToken,
      {
        signingToken: args.signingToken,
      }
    );

    // 2. Get full document from internal query (to access signedStorageId)
    const document = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      {
        documentId: recipient.documentId,
      }
    );

    if (!document) {
      throw new ConvexError("Document not found");
    }

    // 3. Get recipients for name labels and completion check
    const recipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: document._id }
    );

    const allRecipientsComplete =
      recipients.length > 0 &&
      recipients.every((docRecipient) =>
        isRecipientComplete(docRecipient.role, docRecipient.status)
      );

    // 4. Check if signed PDF already exists and document is fully complete
    if (document.signedStorageId && allRecipientsComplete) {
      const url = await ctx.storage.getUrl(document.signedStorageId);
      if (url) {
        return { url, documentName: document.name };
      }
    }

    // 5. Get all signatures for this document (decrypted for PDF embedding)
    const signatures = await ctx.runQuery(
      internal.signatures.queries.getDecryptedSignaturesByDocumentInternal,
      {
        documentId: document._id,
      }
    );

    // If no signatures yet, return original PDF
    if (signatures.length === 0) {
      const url = await ctx.storage.getUrl(document.storageId);
      if (!url) throw new ConvexError("PDF file not found");
      return { url, documentName: document.name };
    }

    // 6. Get the original PDF
    const pdfUrl = await ctx.storage.getUrl(document.storageId);
    if (!pdfUrl) {
      throw new ConvexError("PDF file not found in storage");
    }

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new ConvexError("Failed to download PDF");
    }

    const pdfBuffer = await response.arrayBuffer();

    // 7. Load PDF and prepare for signing
    const { PDFDocument: PDFDocumentLib, StandardFonts: StandardFontsLib } =
      await import("pdf-lib");
    const pdfDoc = await PDFDocumentLib.load(pdfBuffer);

    // Get signature fields to know where to place signatures
    const signatureFields: Doc<"signature_fields">[] = await ctx.runQuery(
      internal.signature_fields.queries.getFieldsByDocumentInternal,
      { documentId: document._id }
    );

    // Embed fonts for text rendering
    const helvetica = await pdfDoc.embedFont(StandardFontsLib.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(
      StandardFontsLib.HelveticaBold
    );

    // 8. Embed signatures into the PDF
    await embedSignaturesIntoPdf(
      pdfDoc,
      document,
      signatures,
      signatureFields,
      recipients,
      helvetica,
      helveticaBold
    );

    // 9. Save the signed PDF
    const signedPdfBytes = await pdfDoc.save();

    // 10. Store the signed PDF
    const signedBlob = new Blob([new Uint8Array(signedPdfBytes)], {
      type: "application/pdf",
    });
    const signedStorageId = await ctx.storage.store(signedBlob);

    // 11. Update the document with the signed PDF reference only once fully complete
    if (allRecipientsComplete) {
      await ctx.runMutation(
        internal.documents.mutations.updateSignedStorageId,
        {
          documentId: document._id,
          signedStorageId,
        }
      );
    }

    // 12. Return the signed PDF URL
    const signedUrl = await ctx.storage.getUrl(signedStorageId);
    if (!signedUrl) {
      throw new ConvexError("Failed to get signed PDF URL");
    }

    return { url: signedUrl, documentName: document.name };
  },
});
