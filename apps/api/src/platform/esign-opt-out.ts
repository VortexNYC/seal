/**
 * ESIGN opt-out / manual-signature path (SEA-58).
 * CompAI fnd_6ab563f5d67363c2a3e06fb8 — demonstrable alternative to e-sign.
 */

export const ESIGN_OPT_OUT_METHODS = [
  "download_pdf",
  "paper_copy_request",
  "contact_sender",
] as const;

export type EsignOptOutMethod = (typeof ESIGN_OPT_OUT_METHODS)[number];

export function resolveEsignOptOutMethod(
  method: string | null | undefined
): EsignOptOutMethod {
  if (
    method === "download_pdf" ||
    method === "paper_copy_request" ||
    method === "contact_sender"
  ) {
    return method;
  }
  return "paper_copy_request";
}

export function describeEsignOptOutMethod(method: EsignOptOutMethod): string {
  switch (method) {
    case "download_pdf":
      return "Downloaded PDF for manual (wet-ink) signing";
    case "paper_copy_request":
      return "Requested a paper copy from the sender";
    case "contact_sender":
      return "Asked to contact the document sender for a non-electronic path";
  }
}
