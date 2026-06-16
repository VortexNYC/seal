import type { CaseId } from "../../domain/common";
import type { OperatorCase } from "../../operators/cases";
import type { QueueKey, QueueMetrics } from "../../operators/queues";
import type { CursorPage } from "./common";

export interface OperatorCaseListResponse extends CursorPage<OperatorCase> {}

export interface AssignCaseRequest {
  readonly assignedToUserId?: string;
  readonly assignedTeamKey?: string;
}

export interface ResolveCaseRequest {
  readonly outcome: string;
  readonly reasonCode?: string;
  readonly note?: string;
}

export interface AddCaseNoteRequest {
  readonly body: string;
}

export interface QueueCasesResponse extends CursorPage<OperatorCase> {
  readonly queueKey: QueueKey;
}

export interface QueueMetricsResponse {
  readonly queueKey: QueueKey;
  readonly metrics: QueueMetrics;
}

export interface CaseActionResponse {
  readonly caseId: CaseId;
  readonly status: OperatorCase["status"];
}
