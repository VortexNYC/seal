import type {
  CaseId,
  Environment,
  IsoTimestamp,
  MerchantAccountId,
  PlatformTenantId,
} from "../domain/common";

export type CaseType =
  | "merchant_onboarding_case"
  | "merchant_remediation_case"
  | "settlement_review_case"
  | "payout_exception_case"
  | "refund_review_case"
  | "dispute_case";

export type CaseStatus =
  | "open"
  | "in_progress"
  | "waiting_on_merchant"
  | "waiting_on_provider"
  | "escalated"
  | "resolved"
  | "closed"
  | "canceled";

export type CasePriority = "critical" | "high" | "normal" | "low";

export interface LinkedObjectRef {
  readonly objectType: string;
  readonly objectId: string;
  readonly relationship:
    | "primary"
    | "related"
    | "caused_by"
    | "blocks"
    | "evidence_for"
    | "resolved_by";
}

export interface CaseAssignment {
  readonly queueKey: string;
  readonly assignedToUserId?: string;
  readonly assignedTeamKey?: string;
  readonly assignedAt?: IsoTimestamp;
  readonly assignmentMode: "unassigned" | "manual" | "automatic";
}

export interface CaseSla {
  readonly firstResponseDueAt?: IsoTimestamp;
  readonly nextActionDueAt?: IsoTimestamp;
  readonly resolutionDueAt?: IsoTimestamp;
  readonly merchantResponseDueAt?: IsoTimestamp;
  readonly externalDeadlineAt?: IsoTimestamp;
  readonly breachedAt?: IsoTimestamp;
  readonly slaPolicyKey?: string;
}

export interface CaseResolution {
  readonly outcome: string;
  readonly reasonCode?: string;
  readonly note?: string;
  readonly resolvedBy: string;
  readonly resolvedAt: IsoTimestamp;
}

export interface OperatorCase {
  readonly id: CaseId;
  readonly environment: Environment;
  readonly caseType: CaseType;
  readonly status: CaseStatus;
  readonly priority: CasePriority;
  readonly tenantId: PlatformTenantId;
  readonly merchantAccountId: MerchantAccountId;
  readonly summary: string;
  readonly description?: string;
  readonly reasonCodes: readonly string[];
  readonly linkedObjectRefs: readonly LinkedObjectRef[];
  readonly sourceEventRefs: readonly string[];
  readonly policyRefs: readonly string[];
  readonly assignment: CaseAssignment;
  readonly sla: CaseSla;
  readonly openedAt: IsoTimestamp;
  readonly lastActionAt: IsoTimestamp;
  readonly closedAt?: IsoTimestamp;
  readonly resolution?: CaseResolution;
  readonly reopenCount: number;
}

export interface CaseActivity {
  readonly id: string;
  readonly environment: Environment;
  readonly caseId: CaseId;
  readonly activityType: string;
  readonly actorType: "system" | "operator" | "merchant";
  readonly actorId?: string;
  readonly summary: string;
  readonly payload?: Readonly<Record<string, string>>;
  readonly linkedEventRef?: string;
  readonly linkedAuditEventRef?: string;
  readonly occurredAt: IsoTimestamp;
}

export interface CaseNote {
  readonly id: string;
  readonly environment: Environment;
  readonly caseId: CaseId;
  readonly authorUserId: string;
  readonly visibility: "internal";
  readonly body: string;
  readonly createdAt: IsoTimestamp;
  readonly editedAt?: IsoTimestamp;
}
