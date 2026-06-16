import type {
  AcceptDisputeCommand,
  CreateDisputeEvidenceCommand,
  DisputeAdjustmentTransferList,
  DisputeEvidenceActionResult,
  DisputeEvidenceList,
  DisputeProviderActionResult,
  GetDisputeEvidenceQuery,
  GetMerchantDisputeQuery,
  ListDisputeAdjustmentTransfersQuery,
  ListDisputeEvidenceQuery,
  ListMerchantDisputesQuery,
  MerchantDisputeDetail,
  MerchantDisputeList,
  SubmitDisputeEvidenceCommand,
} from "./contracts";

export interface DisputesService {
  listMerchantDisputes(query: ListMerchantDisputesQuery): Promise<MerchantDisputeList>;
  getMerchantDispute(query: GetMerchantDisputeQuery): Promise<MerchantDisputeDetail>;
  acceptDispute(command: AcceptDisputeCommand): Promise<DisputeProviderActionResult>;
  createDisputeEvidence(command: CreateDisputeEvidenceCommand): Promise<DisputeEvidenceActionResult>;
  getDisputeEvidence(query: GetDisputeEvidenceQuery): Promise<DisputeEvidenceActionResult>;
  listDisputeEvidence(query: ListDisputeEvidenceQuery): Promise<DisputeEvidenceList>;
  submitDisputeEvidence(command: SubmitDisputeEvidenceCommand): Promise<DisputeEvidenceActionResult>;
  listDisputeAdjustmentTransfers(query: ListDisputeAdjustmentTransfersQuery): Promise<DisputeAdjustmentTransferList>;
}
