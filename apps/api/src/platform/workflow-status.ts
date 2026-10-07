/** Agent void stored `voided`. The product status is `cancelled`. */
export function presentedWorkflowStatus(status: string): string {
  return status === "voided" ? "cancelled" : status;
}

export function isEnvelopeClosed(status: string): boolean {
  return status === "voided" || status === "cancelled";
}
