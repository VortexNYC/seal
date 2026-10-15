/** Agent void stored `voided`. The product status is `cancelled`. */
export function presentedWorkflowStatus(status: string): string {
  return status === "voided" ? "cancelled" : status;
}

export function isEnvelopeClosed(status: string): boolean {
  return status === "voided" || status === "cancelled";
}

/** A sent or completed envelope can become a template. A closed or deleted one cannot. */
export function saveAsTemplateBlock(
  status: string,
  documentStatus: string,
  storageKey: string | null
): "closed" | "missing_file" | null {
  if (
    documentStatus !== "active" ||
    status === "deleted" ||
    isEnvelopeClosed(status)
  ) {
    return "closed";
  }
  if (!storageKey) return "missing_file";
  return null;
}
