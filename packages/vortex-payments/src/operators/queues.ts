export type QueueKey =
  | "onboarding_review"
  | "merchant_remediation"
  | "capability_restrictions"
  | "settlement_review"
  | "payout_exceptions"
  | "refund_review"
  | "disputes"
  | "audit_review";

export type QueueSlice =
  | "all_active"
  | "unassigned"
  | "mine"
  | "team"
  | "breaching_sla"
  | "waiting_on_merchant"
  | "waiting_on_provider"
  | "escalated";

export interface QueueMetrics {
  readonly activeCount: number;
  readonly unassignedCount: number;
  readonly breachedSlaCount: number;
  readonly dueSoonCount: number;
  readonly medianAgeSinceOpenedHours: number;
  readonly medianAgeSinceLastActionHours: number;
  readonly throughputLast7Days: number;
}
