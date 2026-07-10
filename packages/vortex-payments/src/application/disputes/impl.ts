import type { DisputeId, Environment, MerchantAccountId, ProcessorRef } from "../../domain/common";
import type { Dispute } from "../../domain/disputes";
import type { MerchantAccount } from "../../domain/merchant";
import type { ProviderContext, ProviderError } from "../../providers/types";
import type { ProviderRegistry } from "../../providers/registry";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type {
  AcceptDisputeCommand,
  CreateDisputeEvidenceCommand,
  DisputeAdjustmentTransferList,
  DisputeEvidenceActionResult,
  DisputeEvidenceList,
  DisputeSnapshot,
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
import type { DisputesService } from "./service";

export class DisputesServiceError extends Error {
  readonly code:
    | "invalid_request"
    | "not_found"
    | "conflict"
    | "action_required"
    | "provider_unavailable"
    | "internal_error";
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string>>;

  constructor(
    code: DisputesServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "DisputesServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface DisputesServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly providers?: ProviderRegistry;
  readonly resolveProviderContext?: (merchant: MerchantAccount) => ProviderContext;
  readonly now?: () => string;
}

function mapProviderError(error: ProviderError): DisputesServiceError {
  const code =
    error.category === "authentication_failed"
      ? "provider_unavailable"
      : error.category === "rate_limited"
        ? "provider_unavailable"
        : error.category === "temporarily_unavailable"
          ? "provider_unavailable"
          : error.category === "invalid_request"
            ? "invalid_request"
            : error.category === "not_supported"
              ? "invalid_request"
              : error.category === "action_required"
                ? "action_required"
                : "provider_unavailable";
  return new DisputesServiceError(code, error.message, {
    retryable: error.retryable,
    details: { provider: error.provider, providerCode: error.code },
  });
}

async function getMerchantOrThrow(
  uow: PaymentsUnitOfWork,
  environment: Environment,
  merchantAccountId: MerchantAccountId,
): Promise<MerchantAccount> {
  const merchant = await uow.merchants.getById(merchantAccountId, { environment });
  if (!merchant) {
    throw new DisputesServiceError("not_found", "merchant account not found", {
      details: { merchantAccountId },
    });
  }
  return merchant;
}

async function getDisputeOrThrow(
  uow: PaymentsUnitOfWork,
  environment: Environment,
  merchantAccountId: MerchantAccountId,
  disputeId: DisputeId,
): Promise<Dispute> {
  const dispute = await uow.disputes.getById(disputeId, { environment });
  if (!dispute || dispute.merchantAccountId !== merchantAccountId) {
    throw new DisputesServiceError("not_found", "dispute not found", {
      details: { disputeId, merchantAccountId },
    });
  }
  return dispute;
}

function selectDisputeRef(dispute: Dispute, provider: ProviderContext["provider"]): ProcessorRef {
  const disputeRef = dispute.processorRefs.find(
    (processorRef) => processorRef.provider === provider && processorRef.objectType === "dispute",
  );
  if (!disputeRef) {
    throw new DisputesServiceError(
      "invalid_request",
      "dispute is missing provider dispute reference",
      {
        details: { disputeId: dispute.id, provider },
      },
    );
  }
  return disputeRef;
}

function toDisputeSnapshot(dispute: Dispute): DisputeSnapshot {
  return {
    id: dispute.id,
    environment: dispute.environment,
    merchantAccountId: dispute.merchantAccountId,
    paymentId: dispute.paymentId,
    amount: dispute.amount,
    currency: dispute.currency,
    network: dispute.network,
    reasonCode: dispute.reasonCode,
    stage: dispute.stage,
    responseState: dispute.responseState,
    deadlineAt: dispute.deadlineAt,
    evidenceStatus: dispute.evidenceStatus,
    ...(dispute.terminalSessionId ? { terminalSessionId: dispute.terminalSessionId } : {}),
    ...(dispute.terminalReaderId ? { terminalReaderId: dispute.terminalReaderId } : {}),
    openedAt: dispute.openedAt,
    closedAt: dispute.closedAt,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
  };
}

function requireProviderDependencies(dependencies: DisputesServiceDependencies): {
  readonly providers: ProviderRegistry;
  readonly resolveProviderContext: (merchant: MerchantAccount) => ProviderContext;
} {
  if (!dependencies.providers || !dependencies.resolveProviderContext) {
    throw new DisputesServiceError("internal_error", "dispute provider actions are not configured");
  }
  return {
    providers: dependencies.providers,
    resolveProviderContext: dependencies.resolveProviderContext,
  };
}

async function resolveProviderActionContext(
  dependencies: DisputesServiceDependencies,
  environment: Environment,
  merchantAccountId: MerchantAccountId,
  disputeId: DisputeId,
): Promise<{
  readonly merchant: MerchantAccount;
  readonly dispute: Dispute;
  readonly providerContext: ProviderContext;
  readonly disputeRef: ProcessorRef;
}> {
  const { resolveProviderContext } = requireProviderDependencies(dependencies);
  const merchant = await getMerchantOrThrow(dependencies.uow, environment, merchantAccountId);
  const dispute = await getDisputeOrThrow(
    dependencies.uow,
    environment,
    merchantAccountId,
    disputeId,
  );
  const providerContext = resolveProviderContext(merchant);
  return {
    merchant,
    dispute,
    providerContext,
    disputeRef: selectDisputeRef(dispute, providerContext.provider),
  };
}

async function listMerchantDisputes(
  dependencies: DisputesServiceDependencies,
  query: ListMerchantDisputesQuery,
): Promise<MerchantDisputeList> {
  const items = [
    ...(await dependencies.uow.disputes.listByMerchant(query.environment, query.merchantAccountId)),
  ]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(toDisputeSnapshot);
  return {
    items,
    hasMore: false,
  };
}

async function getMerchantDispute(
  dependencies: DisputesServiceDependencies,
  query: GetMerchantDisputeQuery,
): Promise<MerchantDisputeDetail> {
  const dispute = await dependencies.uow.disputes.getById(query.disputeId, {
    environment: query.environment,
  });
  if (!dispute || dispute.merchantAccountId !== query.merchantAccountId) {
    return null;
  }
  return toDisputeSnapshot(dispute);
}

function missingProviderResultError(
  providerContext: ProviderContext,
  message: string,
): ProviderError {
  return {
    provider: providerContext.provider,
    category: "unknown",
    code: "provider_result_missing",
    message,
    retryable: false,
  };
}

async function acceptDispute(
  dependencies: DisputesServiceDependencies,
  command: AcceptDisputeCommand,
  now: () => string,
): Promise<DisputeProviderActionResult> {
  const { providers } = requireProviderDependencies(dependencies);
  const { dispute, providerContext, disputeRef } = await resolveProviderActionContext(
    dependencies,
    command.environment,
    command.merchantAccountId,
    command.disputeId,
  );
  const adapter = providers.getAdapter(providerContext.provider);
  if (!adapter.acceptDispute) {
    throw new DisputesServiceError(
      "invalid_request",
      "provider does not support dispute accept action",
      {
        details: { provider: providerContext.provider },
      },
    );
  }
  const providerResult = await adapter.acceptDispute(providerContext, {
    disputeRef,
    tags: command.tags,
  });
  if (!providerResult.ok || !providerResult.value) {
    throw mapProviderError(
      providerResult.error ??
        missingProviderResultError(
          providerContext,
          "provider dispute accept failed without error details",
        ),
    );
  }
  const updatedDispute: Dispute = {
    ...dispute,
    responseState: "accepted",
    evidenceStatus: "accepted",
    updatedAt: now(),
  };
  await dependencies.uow.disputes.save(updatedDispute);
  return {
    dispute: toDisputeSnapshot(updatedDispute),
    action: "accepted",
    actionState: providerResult.value.state,
  };
}

async function createDisputeEvidence(
  dependencies: DisputesServiceDependencies,
  command: CreateDisputeEvidenceCommand,
): Promise<DisputeEvidenceActionResult> {
  const { providers } = requireProviderDependencies(dependencies);
  const { dispute, providerContext, disputeRef } = await resolveProviderActionContext(
    dependencies,
    command.environment,
    command.merchantAccountId,
    command.disputeId,
  );
  const adapter = providers.getAdapter(providerContext.provider);
  if (!adapter.createDisputeEvidence) {
    throw new DisputesServiceError(
      "invalid_request",
      "provider does not support dispute evidence creation",
      {
        details: { provider: providerContext.provider },
      },
    );
  }
  const providerResult = await adapter.createDisputeEvidence(providerContext, {
    disputeRef,
    fileRef: command.fileRef,
    type: command.type,
    tags: command.tags,
  });
  if (!providerResult.ok || !providerResult.value) {
    throw mapProviderError(
      providerResult.error ??
        missingProviderResultError(
          providerContext,
          "provider dispute evidence creation failed without error details",
        ),
    );
  }
  return {
    dispute: toDisputeSnapshot(dispute),
    evidence: {
      state: providerResult.value.state,
      type: providerResult.value.type,
    },
  };
}

async function getDisputeEvidence(
  dependencies: DisputesServiceDependencies,
  query: GetDisputeEvidenceQuery,
): Promise<DisputeEvidenceActionResult> {
  const { providers } = requireProviderDependencies(dependencies);
  const { dispute, providerContext, disputeRef } = await resolveProviderActionContext(
    dependencies,
    query.environment,
    query.merchantAccountId,
    query.disputeId,
  );
  const adapter = providers.getAdapter(providerContext.provider);
  if (!adapter.getDisputeEvidence) {
    throw new DisputesServiceError(
      "invalid_request",
      "provider does not support dispute evidence reads",
      {
        details: { provider: providerContext.provider },
      },
    );
  }
  const providerResult = await adapter.getDisputeEvidence(providerContext, {
    disputeRef,
    evidenceRef: query.evidenceRef,
  });
  if (!providerResult.ok || !providerResult.value) {
    throw mapProviderError(
      providerResult.error ??
        missingProviderResultError(
          providerContext,
          "provider dispute evidence read failed without error details",
        ),
    );
  }
  return {
    dispute: toDisputeSnapshot(dispute),
    evidence: {
      state: providerResult.value.state,
      type: providerResult.value.type,
    },
  };
}

async function listDisputeEvidence(
  dependencies: DisputesServiceDependencies,
  query: ListDisputeEvidenceQuery,
): Promise<DisputeEvidenceList> {
  const { providers } = requireProviderDependencies(dependencies);
  const { providerContext, disputeRef } = await resolveProviderActionContext(
    dependencies,
    query.environment,
    query.merchantAccountId,
    query.disputeId,
  );
  const adapter = providers.getAdapter(providerContext.provider);
  if (!adapter.listDisputeEvidence) {
    throw new DisputesServiceError(
      "invalid_request",
      "provider does not support dispute evidence listing",
      {
        details: { provider: providerContext.provider },
      },
    );
  }
  const providerResult = await adapter.listDisputeEvidence(providerContext, { disputeRef });
  if (!providerResult.ok || !providerResult.value) {
    throw mapProviderError(
      providerResult.error ??
        missingProviderResultError(
          providerContext,
          "provider dispute evidence list failed without error details",
        ),
    );
  }
  return {
    items: providerResult.value.items.map((item) => ({
      state: item.state,
      type: item.type,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    hasMore: false,
  };
}

async function submitDisputeEvidence(
  dependencies: DisputesServiceDependencies,
  command: SubmitDisputeEvidenceCommand,
  now: () => string,
): Promise<DisputeEvidenceActionResult> {
  const { providers } = requireProviderDependencies(dependencies);
  const { dispute, providerContext, disputeRef } = await resolveProviderActionContext(
    dependencies,
    command.environment,
    command.merchantAccountId,
    command.disputeId,
  );
  const adapter = providers.getAdapter(providerContext.provider);
  if (!adapter.submitDisputeEvidence) {
    throw new DisputesServiceError(
      "invalid_request",
      "provider does not support dispute evidence submission",
      {
        details: { provider: providerContext.provider },
      },
    );
  }
  if (command.note.trim().length === 0) {
    throw new DisputesServiceError("invalid_request", "dispute evidence submit note is required");
  }
  const providerResult = await adapter.submitDisputeEvidence(providerContext, {
    disputeRef,
    note: command.note,
    amount: command.amount,
    refund: command.refund,
    tags: command.tags,
  });
  if (!providerResult.ok || !providerResult.value) {
    throw mapProviderError(
      providerResult.error ??
        missingProviderResultError(
          providerContext,
          "provider dispute evidence submission failed without error details",
        ),
    );
  }
  const updatedDispute: Dispute = {
    ...dispute,
    responseState: "responded",
    evidenceStatus: "submitted",
    updatedAt: now(),
  };
  await dependencies.uow.disputes.save(updatedDispute);
  return {
    dispute: toDisputeSnapshot(updatedDispute),
    evidence: {
      state: providerResult.value.state,
      type: providerResult.value.type,
    },
  };
}

async function listDisputeAdjustmentTransfers(
  dependencies: DisputesServiceDependencies,
  query: ListDisputeAdjustmentTransfersQuery,
): Promise<DisputeAdjustmentTransferList> {
  const { providers } = requireProviderDependencies(dependencies);
  const { providerContext, disputeRef } = await resolveProviderActionContext(
    dependencies,
    query.environment,
    query.merchantAccountId,
    query.disputeId,
  );
  const adapter = providers.getAdapter(providerContext.provider);
  if (!adapter.listDisputeAdjustments) {
    throw new DisputesServiceError(
      "invalid_request",
      "provider does not support dispute adjustment transfer listing",
      {
        details: { provider: providerContext.provider },
      },
    );
  }
  const providerResult = await adapter.listDisputeAdjustments(providerContext, { disputeRef });
  if (!providerResult.ok || !providerResult.value) {
    throw mapProviderError(
      providerResult.error ??
        missingProviderResultError(
          providerContext,
          "provider dispute adjustment transfer list failed without error details",
        ),
    );
  }
  return {
    items: providerResult.value.items.map((item) => ({
      amount: item.amount,
      currency: item.currency,
      type: item.type,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    hasMore: false,
  };
}

export function createDisputesService(dependencies: DisputesServiceDependencies): DisputesService {
  const now = dependencies.now ?? (() => new Date().toISOString());

  return {
    listMerchantDisputes: (query) => listMerchantDisputes(dependencies, query),
    getMerchantDispute: (query) => getMerchantDispute(dependencies, query),
    acceptDispute: (command) => acceptDispute(dependencies, command, now),
    createDisputeEvidence: (command) => createDisputeEvidence(dependencies, command),
    getDisputeEvidence: (query) => getDisputeEvidence(dependencies, query),
    listDisputeEvidence: (query) => listDisputeEvidence(dependencies, query),
    submitDisputeEvidence: (command) => submitDisputeEvidence(dependencies, command, now),
    listDisputeAdjustmentTransfers: (query) => listDisputeAdjustmentTransfers(dependencies, query),
  };
}
