/**
 * Certificate of Completion (SEA-50 / CompAI EVID-2).
 * Per-envelope evidentiary PDF: parties, emails, IPs, timestamps, doc ref,
 * verification URL. Generated when a document reaches `completed`.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type CertificateParty = {
  name: string;
  email: string;
  role: string;
  status: string;
  /** ISO or locale string already formatted for display */
  completedAt: string | null;
  ipAddress: string | null;
  authMethod: string | null;
  consentAt: string | null;
  consentTextHash: string | null;
  privacyNoticeAt: string | null;
  privacyNoticeTextHash: string | null;
};

export type CertificateOfCompletionInput = {
  documentName: string;
  documentPublicId: string;
  documentId: string;
  organizationName: string;
  completedAt: string;
  documentHash: string | null;
  verificationUrl: string;
  parties: CertificateParty[];
  events: Array<{
    action: string;
    at: string;
    actor: string;
    detail?: string;
  }>;
};

export function certificateStorageKey(
  organizationId: string,
  documentId: string
): string {
  return `certificates/${organizationId}/${documentId}.pdf`;
}

/** StandardFonts Helvetica is WinAnsi — strip non-encodable glyphs. */
export function sanitizePdfText(value: string): string {
  return value
    .replace(/\u2194/g, "<->")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

export async function buildCertificateOfCompletionPdf(
  input: CertificateOfCompletionInput
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.4, 0.45);
  const accent = rgb(0.15, 0.35, 0.75);

  let y = 750;
  const left = 48;
  const width = 516;

  const draw = (
    text: string,
    size: number,
    options?: { bold?: boolean; color?: ReturnType<typeof rgb>; x?: number }
  ): void => {
    page.drawText(sanitizePdfText(text), {
      x: options?.x ?? left,
      y,
      size,
      font: options?.bold ? fontBold : font,
      color: options?.color ?? ink,
      maxWidth: width,
    });
  };

  draw("CERTIFICATE OF COMPLETION", 18, { bold: true, color: accent });
  y -= 22;
  draw("Seal - evidentiary record for this envelope", 10, { color: muted });
  y -= 28;

  draw(input.documentName, 14, { bold: true });
  y -= 16;
  draw(`Document ID: ${input.documentPublicId}`, 9, { color: muted });
  y -= 12;
  draw(`Internal ID: ${input.documentId}`, 8, { color: muted });
  y -= 12;
  draw(`Organization: ${input.organizationName}`, 9, { color: muted });
  y -= 12;
  draw(`Completed: ${input.completedAt}`, 9, { color: muted });
  y -= 12;
  if (input.documentHash) {
    draw(`Document hash: ${input.documentHash}`, 8, { color: muted });
    y -= 12;
  }
  y -= 10;

  page.drawLine({
    start: { x: left, y },
    end: { x: left + width, y },
    thickness: 0.5,
    color: muted,
  });
  y -= 22;

  draw("Parties", 12, { bold: true });
  y -= 16;
  for (const party of input.parties) {
    if (y < 120) {
      // keep simple single-page for v1 — truncate with note
      draw("...additional parties omitted on this page", 8, { color: muted });
      y -= 14;
      break;
    }
    draw(`${party.name}  <${party.email}>`, 10, { bold: true });
    y -= 13;
    draw(
      `${party.role} · ${party.status}` +
        (party.completedAt ? ` · ${party.completedAt}` : "") +
        (party.ipAddress ? ` · IP ${party.ipAddress}` : "") +
        (party.authMethod && party.authMethod !== "none"
          ? ` · auth ${party.authMethod}`
          : "") +
        (party.consentAt ? ` · ESIGN consent ${party.consentAt}` : "") +
        (party.consentTextHash
          ? ` · consent ${party.consentTextHash.slice(0, 18)}…`
          : "") +
        (party.privacyNoticeAt
          ? ` · privacy notice ${party.privacyNoticeAt}`
          : "") +
        (party.privacyNoticeTextHash
          ? ` · privacy ${party.privacyNoticeTextHash.slice(0, 18)}…`
          : ""),
      8,
      { color: muted }
    );
    y -= 16;
  }

  y -= 6;
  page.drawLine({
    start: { x: left, y },
    end: { x: left + width, y },
    thickness: 0.5,
    color: muted,
  });
  y -= 22;

  draw("Event timeline", 12, { bold: true });
  y -= 16;
  for (const event of input.events.slice(0, 18)) {
    if (y < 100) {
      break;
    }
    draw(`${event.at}  ${event.action}`, 8, { bold: true });
    y -= 11;
    draw(
      `${event.actor}${event.detail ? ` - ${event.detail}` : ""}`,
      8,
      { color: muted }
    );
    y -= 14;
  }

  y = Math.min(y, 90);
  page.drawLine({
    start: { x: left, y },
    end: { x: left + width, y },
    thickness: 0.5,
    color: muted,
  });
  y -= 18;
  draw("Verify authenticity", 11, { bold: true });
  y -= 14;
  draw(input.verificationUrl, 8, { color: accent });
  y -= 14;
  draw(
    "Open this URL to confirm the envelope is a Seal-completed record.",
    8,
    { color: muted }
  );
  y -= 20;
  draw(
    "This certificate summarizes the audit trail. It is not a cryptographic seal of the PDF bytes (see SEA-49).",
    7,
    { color: muted }
  );

  return doc.save();
}
