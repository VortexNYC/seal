import type { IsoTimestamp, MerchantAccountId, ProcessorRef, SettlementId } from "../../domain/common";
import type {
  FundingTransferTimelineItem,
  Payout,
  SellerPayoutCapability,
  SellerPayoutProfileSnapshot,
  Settlement,
  SettlementFundingTimeline,
  SettlementPayoutReadiness,
  SettlementPayoutReadinessStatus,
} from "../../domain/funds";
import type { MerchantAccount } from "../../domain/merchant";
import type { ProviderRegistry } from "../../providers/registry";
import type { ProviderContext } from "../../providers/types";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type {
  GetMerchantPayoutQuery,
  GetMerchantSellerPayoutProfileQuery,
  GetSettlementFundingTimelineQuery,
  GetSettlementPayoutReadinessQuery,
  ListMerchantPayoutsQuery,
  MerchantPayoutDetail,
  MerchantPayoutList,
  MerchantSellerPayoutProfileDetail,
  MerchantSellerPayoutProfileSnapshot,
  PayoutSnapshot,
  SettlementFundingTimelineSnapshot,
  FundingTransferTimelineItemSnapshot,
  SettlementFundingTimelineDetail,
  SettlementPayoutReadinessDetail,
} from "./contracts";
import type { PayoutsService } from "./service";

export interface PayoutsServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly providers?: ProviderRegistry;
  readonly resolveProviderContext?: (merchant: MerchantAccount) => ProviderContext;
  readonly now?: () => IsoTimestamp;
}

function defaultNow(): IsoTimestamp {
  return new Date().toISOString();
}

function findMerchantProcessorRef(merchant: MerchantAccount): ProcessorRef | null {
  return merchant.processorAccountRefs.find((ref) => ref.objectType === "merchant")
    ?? merchant.processorAccountRefs[0]
    ?? null;
}

function buildDefaultSellerPayoutCapabilities(snapshot: Omit<SellerPayoutProfileSnapshot, "capabilities">): readonly SellerPayoutCapability[] {
  return [{
    key: "standard_next_day_ach",
    status: snapshot.payoutRail === "next_day_ach" ? "enabled" : "unknown",
    reason: snapshot.payoutRail === "next_day_ach"
      ? "Seller payout profile uses next-day ACH."
      : "Seller payout profile does not prove next-day ACH availability.",
    source: "payout_profile",
  }, {
    key: "same_day_ach",
    status: snapshot.sameDayAchEligible === true ? "enabled" : "disabled",
    reason: snapshot.sameDayAchEligible === true
      ? "Merchant payout profile enables same-day ACH."
      : "Merchant payout profile does not enable same-day ACH; separate approval and prefunding are required.",
    source: "payout_profile",
  }, {
    key: "instant_card_push",
    status: snapshot.instantPayoutEligible === true ? "enabled" : "disabled",
    reason: snapshot.instantPayoutEligible === true
      ? "Merchant payout profile enables instant card-push payouts."
      : "Merchant payout profile does not enable instant card-push payouts; the rail is separately enabled and limitable.",
    source: "payout_profile",
  }, {
    key: "gross_payout",
    status: snapshot.grossPayoutEnabled === true ? "enabled" : "disabled",
    reason: snapshot.grossPayoutEnabled === true
      ? "Merchant payout profile enables gross payouts."
      : "Merchant payout profile does not enable gross payouts; written approval is required.",
    source: "payout_profile",
  }, {
    key: "sub_merchant_payee_payment",
    status: "disabled",
    reason: "Sub-merchant payee payments are a separate settlement-funded service requiring payee verification and risk/compliance acceptance.",
    source: "agreement_guardrail",
  }];
}

function deriveReadinessStatus(args: {
  readonly settlement: Settlement;
  readonly payouts: readonly Payout[];
  readonly merchantPayoutReadiness?: string;
}): { readonly status: SettlementPayoutReadinessStatus; readonly blockers: readonly string[]; readonly nextAction: string } {
  const blockers: string[] = [];
  const terminalSucceededPayout = args.payouts.find((payout) => payout.status === "succeeded");
  if (terminalSucceededPayout) {
    return {
      status: "paid",
      blockers,
      nextAction: "funding_transfer_succeeded",
    };
  }

  const terminalFailedPayout = args.payouts.find((payout) => payout.status === "failed" || payout.status === "returned");
  if (terminalFailedPayout) {
    blockers.push(`funding_transfer_${terminalFailedPayout.status}`);
  }

  if (args.merchantPayoutReadiness === "blocked" || args.merchantPayoutReadiness === "paused") {
    blockers.push(`merchant_payout_${args.merchantPayoutReadiness}`);
  }
  if (args.merchantPayoutReadiness === undefined || args.merchantPayoutReadiness === "unknown") {
    blockers.push("merchant_payout_readiness_unknown");
  }

  if (args.settlement.direction === "debit") {
    blockers.push("negative_or_debit_settlement");
  }
  if (args.settlement.netAmount <= 0) {
    blockers.push("non_positive_net_amount");
  }

  switch (args.settlement.status) {
    case "accruing":
      return {
        status: "waiting",
        blockers: [...blockers, "settlement_still_accruing"],
        nextAction: "wait_for_settlement_close",
      };
    case "failed":
    case "reversed":
      return {
        status: "blocked",
        blockers: [...blockers, `settlement_${args.settlement.status}`],
        nextAction: "inspect_settlement_failure",
      };
    case "paid_out":
      return {
        status: blockers.length > 0 ? "unknown" : "paid",
        blockers,
        nextAction: blockers.length > 0 ? "inspect_funding_transfer_history" : "settlement_paid_out",
      };
    case "closed":
      return {
        status: blockers.length > 0 ? "blocked" : "ready",
        blockers,
        nextAction: blockers.length > 0 ? "resolve_blockers" : "await_finix_approval_or_funding_transfer",
      };
    case "approved":
      return {
        status: blockers.length > 0 ? "blocked" : "ready",
        blockers,
        nextAction: blockers.length > 0 ? "resolve_blockers" : "await_funding_transfer",
      };
  }
}

function buildSettlementTimelineItem(settlement: Settlement): FundingTransferTimelineItem {
  return {
    id: settlement.id,
    kind: "settlement",
    status: settlement.status,
    amount: settlement.netAmount,
    currency: settlement.currency,
    direction: settlement.direction,
    occurredAt: settlement.approvedAt ?? settlement.closedAt ?? settlement.accrualEndAt ?? settlement.updatedAt,
    processorRefs: settlement.processorRefs,
  };
}

function buildPayoutTimelineItem(payout: Payout): FundingTransferTimelineItem {
  return {
    id: payout.id,
    kind: "funding_transfer",
    status: payout.status,
    amount: payout.amount,
    currency: payout.currency,
    direction: payout.direction,
    occurredAt: payout.updatedAt,
    expectedArrivalAt: payout.expectedArrivalAt,
    processorRefs: payout.processorRefs,
  };
}

function toPayoutSnapshot(payout: Payout): PayoutSnapshot {
  return {
    id: payout.id,
    environment: payout.environment,
    merchantAccountId: payout.merchantAccountId,
    payoutAccountId: payout.payoutAccountId,
    settlementId: payout.settlementId,
    amount: payout.amount,
    currency: payout.currency,
    direction: payout.direction,
    status: payout.status,
    expectedArrivalAt: payout.expectedArrivalAt,
    failureCode: payout.failureCode,
    failureMessage: payout.failureMessage,
    createdAt: payout.createdAt,
    updatedAt: payout.updatedAt,
  };
}

function toFundingTimelineItemSnapshot(item: FundingTransferTimelineItem): FundingTransferTimelineItemSnapshot {
  return {
    id: item.id,
    kind: item.kind,
    status: item.status,
    amount: item.amount,
    currency: item.currency,
    direction: item.direction,
    occurredAt: item.occurredAt,
    expectedArrivalAt: item.expectedArrivalAt,
  };
}

function toSellerPayoutProfileSnapshot(snapshot: SellerPayoutProfileSnapshot): MerchantSellerPayoutProfileSnapshot {
  return {
    environment: snapshot.environment,
    merchantAccountId: snapshot.merchantAccountId,
    mode: snapshot.mode,
    payoutRail: snapshot.payoutRail,
    payoutSchedule: snapshot.payoutSchedule,
    currency: snapshot.currency,
    settlementDelayDays: snapshot.settlementDelayDays,
    submissionDelayDays: snapshot.submissionDelayDays,
    fundingRequirement: snapshot.fundingRequirement,
    sameDayAchEligible: snapshot.sameDayAchEligible,
    instantPayoutEligible: snapshot.instantPayoutEligible,
    grossPayoutEnabled: snapshot.grossPayoutEnabled,
    capabilities: snapshot.capabilities,
    fetchedAt: snapshot.fetchedAt,
  };
}

async function getScopedSettlement(
  uow: PaymentsUnitOfWork,
  query: { readonly environment: "sandbox" | "production"; readonly merchantAccountId: MerchantAccountId; readonly settlementId: SettlementId },
): Promise<Settlement | null> {
  const settlement = await uow.settlements.getById(query.settlementId, {
    environment: query.environment,
  });
  if (!settlement || settlement.merchantAccountId !== query.merchantAccountId) {
    return null;
  }
  return settlement;
}

export function createPayoutsService(
  dependencies: PayoutsServiceDependencies,
): PayoutsService {
  const now = dependencies.now ?? defaultNow;

  return {
    async listMerchantPayouts(query: ListMerchantPayoutsQuery): Promise<MerchantPayoutList> {
      const payouts = await dependencies.uow.payouts.listByMerchant(
        query.environment,
        query.merchantAccountId,
      );
      const items = payouts
        .filter((payout) => query.currency === undefined || payout.currency === query.currency)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(toPayoutSnapshot);
      return {
        items,
        hasMore: false,
      };
    },

    async getMerchantPayout(query: GetMerchantPayoutQuery): Promise<MerchantPayoutDetail> {
      const payout = await dependencies.uow.payouts.getById(query.payoutId, {
        environment: query.environment,
      });
      if (!payout || payout.merchantAccountId !== query.merchantAccountId) {
        return null;
      }
      return toPayoutSnapshot(payout);
    },

    async getMerchantSellerPayoutProfile(
      query: GetMerchantSellerPayoutProfileQuery,
    ): Promise<MerchantSellerPayoutProfileDetail> {
      const merchant = await dependencies.uow.merchants.getById(query.merchantAccountId, {
        environment: query.environment,
      });
      if (!merchant || !dependencies.providers || !dependencies.resolveProviderContext) {
        return null;
      }
      const merchantRef = findMerchantProcessorRef(merchant);
      if (!merchantRef) {
        return null;
      }
      const providerContext = dependencies.resolveProviderContext(merchant);
      const adapter = dependencies.providers.getAdapter(providerContext.provider);
      if (!adapter.getSellerPayoutProfile) {
        return null;
      }
      const result = await adapter.getSellerPayoutProfile(providerContext, {
        merchantAccountId: query.merchantAccountId,
        merchantRef,
      });
      if (!result.ok || !result.value) {
        return null;
      }
      const { capabilities, ...providerSnapshot } = result.value;
      const snapshotWithoutCapabilities = {
        environment: query.environment,
        merchantAccountId: query.merchantAccountId,
        provider: providerContext.provider,
        ...providerSnapshot,
      };
      const snapshot: SellerPayoutProfileSnapshot = {
        ...snapshotWithoutCapabilities,
        capabilities: capabilities ?? buildDefaultSellerPayoutCapabilities(snapshotWithoutCapabilities),
      };
      await dependencies.uow.sellerPayoutProfileSnapshots?.save(snapshot);
      return toSellerPayoutProfileSnapshot(snapshot);
    },

    async getSettlementPayoutReadiness(
      query: GetSettlementPayoutReadinessQuery,
    ): Promise<SettlementPayoutReadinessDetail> {
      const settlement = await getScopedSettlement(dependencies.uow, query);
      if (!settlement) {
        return null;
      }
      const [merchantState, allPayouts] = await Promise.all([
        dependencies.uow.merchantStates.getByMerchantAccountId(query.merchantAccountId, {
          environment: query.environment,
        }),
        dependencies.uow.payouts.listByMerchant(query.environment, query.merchantAccountId),
      ]);
      const payouts = allPayouts.filter((payout) => payout.settlementId === query.settlementId);
      const derived = deriveReadinessStatus({
        settlement,
        payouts,
        merchantPayoutReadiness: merchantState?.payoutReadiness,
      });
      const readiness: SettlementPayoutReadiness = {
        environment: query.environment,
        merchantAccountId: query.merchantAccountId,
        settlementId: query.settlementId,
        status: derived.status,
        blockers: derived.blockers,
        nextAction: derived.nextAction,
        settlementStatus: settlement.status,
        merchantPayoutReadiness: merchantState?.payoutReadiness,
        payoutIds: payouts.map((payout) => payout.id),
        generatedAt: now(),
      };
      return readiness;
    },

    async getSettlementFundingTimeline(
      query: GetSettlementFundingTimelineQuery,
    ): Promise<SettlementFundingTimelineDetail> {
      const settlement = await getScopedSettlement(dependencies.uow, query);
      if (!settlement) {
        return null;
      }
      const payouts = (await dependencies.uow.payouts.listByMerchant(query.environment, query.merchantAccountId))
        .filter((payout) => payout.settlementId === query.settlementId);
      const items = [
        buildSettlementTimelineItem(settlement),
        ...payouts.map((payout) => buildPayoutTimelineItem(payout)),
      ].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
      const timeline: SettlementFundingTimeline = {
        environment: query.environment,
        merchantAccountId: query.merchantAccountId,
        settlementId: query.settlementId,
        items,
        generatedAt: now(),
      };
      const publicTimeline: SettlementFundingTimelineSnapshot = {
        ...timeline,
        items: timeline.items.map(toFundingTimelineItemSnapshot),
      };
      return publicTimeline;
    },
  };
}
