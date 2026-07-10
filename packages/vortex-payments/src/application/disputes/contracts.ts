import type { CursorPage } from "../../api/contract/common";
import type {
  DisputeId,
  Environment,
  MerchantAccountId,
  Metadata,
  ProcessorRef,
} from "../../domain/common";
import type { DisputeResponseState, DisputeStage } from "../../domain/disputes";
import type { ProviderDisputeEvidenceSummary, ProviderDisputeSummary } from "../../providers/types";

export interface ReviewDisputeCommand {
  readonly environment: Environment;
  readonly disputeId: DisputeId;
  readonly merchantAccountId: MerchantAccountId;
  readonly action: "accept" | "challenge" | "submit_evidence";
  readonly actedByType: "operator" | "merchant";
  readonly actedByRef: string;
  readonly evidenceDocumentIds?: readonly string[];
  readonly note?: string;
}

export interface AcceptDisputeCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly disputeId: DisputeId;
  readonly tags?: Metadata;
}

export interface CreateDisputeEvidenceCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly disputeId: DisputeId;
  readonly fileRef: ProcessorRef;
  readonly type?: string;
  readonly tags?: Metadata;
}

export interface GetDisputeEvidenceQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly disputeId: DisputeId;
  readonly evidenceRef: ProcessorRef;
}

export interface ListDisputeEvidenceQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly disputeId: DisputeId;
}

export interface SubmitDisputeEvidenceCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly disputeId: DisputeId;
  readonly note: string;
  readonly amount?: number;
  readonly refund?: string;
  readonly tags?: Metadata;
}

export interface ListDisputeAdjustmentTransfersQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly disputeId: DisputeId;
}

export interface DisputeSnapshot {
  readonly id: DisputeId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly paymentId: string;
  readonly amount: number;
  readonly currency: string;
  readonly network?: string;
  readonly reasonCode?: string;
  readonly stage: DisputeStage;
  readonly responseState: DisputeResponseState;
  readonly deadlineAt?: string;
  readonly evidenceStatus?: string;
  readonly terminalSessionId?: string;
  readonly terminalReaderId?: string;
  readonly openedAt: string;
  readonly closedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListMerchantDisputesQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
}

export interface GetMerchantDisputeQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly disputeId: DisputeId;
}

export interface DisputeProviderActionResult {
  readonly dispute: DisputeSnapshot;
  readonly action: "accepted";
  readonly actionState?: ProviderDisputeSummary["state"];
}

export interface DisputeEvidenceActionResult {
  readonly dispute: DisputeSnapshot;
  readonly evidence: {
    readonly state?: ProviderDisputeEvidenceSummary["state"];
    readonly type?: ProviderDisputeEvidenceSummary["type"];
  };
}

export interface DisputeEvidenceSnapshot {
  readonly state?: string;
  readonly type?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DisputeAdjustmentTransferSnapshot {
  readonly amount?: number;
  readonly currency?: string;
  readonly type?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface DisputeEvidenceList extends CursorPage<DisputeEvidenceSnapshot> {}
export interface DisputeAdjustmentTransferList extends CursorPage<DisputeAdjustmentTransferSnapshot> {}

export interface MerchantDisputeList extends CursorPage<DisputeSnapshot> {}

export type MerchantDisputeDetail = DisputeSnapshot | null;
