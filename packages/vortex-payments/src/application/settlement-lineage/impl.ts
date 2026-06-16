import type { MerchantAccount } from "../../domain/merchant";
import type { SettlementLineageEntry } from "../../domain/funds";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type { ProviderRegistry } from "../../providers/registry";
import type { ProviderContext } from "../../providers/types";
import type { SettlementLineageService } from "./service";
import type { SyncSettlementLineageQuery, SyncSettlementLineageResult } from "./contracts";

export interface SettlementLineageServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly providers: ProviderRegistry;
  readonly resolveProviderContext: (merchant: MerchantAccount) => ProviderContext;
  readonly now?: () => string;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function createLineageEntryId(settlementId: string, rowRef: SettlementLineageEntry["providerRowRef"]): string {
  return `${settlementId}:${rowRef.objectType}:${rowRef.objectId}`;
}

export function createSettlementLineageService(
  dependencies: SettlementLineageServiceDependencies,
): SettlementLineageService {
  const now = dependencies.now ?? defaultNow;

  return {
    async syncSettlementLineage(query: SyncSettlementLineageQuery): Promise<SyncSettlementLineageResult | null> {
      const settlementLineageEntries = dependencies.uow.settlementLineageEntries;
      if (!settlementLineageEntries) {
        throw new Error("settlement lineage repository is not configured");
      }

      const settlement = await dependencies.uow.settlements.getById(query.settlementId, {
        environment: query.environment,
      });
      if (!settlement || settlement.merchantAccountId !== query.merchantAccountId) {
        return null;
      }

      const merchant = await dependencies.uow.merchants.getById(query.merchantAccountId, {
        environment: query.environment,
      });
      if (!merchant) {
        return null;
      }

      const settlementRef = settlement.processorRefs.find((ref) => ref.relationship === "settlement") ?? settlement.processorRefs[0] ?? null;
      if (!settlementRef) {
        throw new Error(`settlement ${query.settlementId} is missing processor settlement reference`);
      }

      const providerContext = dependencies.resolveProviderContext(merchant);
      const adapter = dependencies.providers.getAdapter(providerContext.provider);
      const listSettlementLineage = adapter.listSettlementLineage;
      if (!listSettlementLineage) {
        throw new Error(`provider ${providerContext.provider} does not support settlement lineage`);
      }

      const listed = await listSettlementLineage(providerContext, { settlementRef });
      if (!listed.ok) {
        throw new Error(listed.error?.message ?? "provider settlement lineage unavailable");
      }
      const rows = listed.value?.items ?? [];

      const entries: SettlementLineageEntry[] = [];
      for (const row of rows) {
        const [payment, refund] = await Promise.all([
          dependencies.uow.payments.getByProcessorRef?.(
            query.environment,
            row.rowRef.provider,
            row.rowRef.objectType,
            row.rowRef.objectId,
          ) ?? Promise.resolve(null),
          dependencies.uow.refunds.getByProcessorRef(
            query.environment,
            row.rowRef.provider,
            row.rowRef.objectType,
            row.rowRef.objectId,
          ),
        ]);
        const timestamp = now();
        const entry: SettlementLineageEntry = {
          id: createLineageEntryId(query.settlementId, row.rowRef),
          environment: query.environment,
          merchantAccountId: query.merchantAccountId,
          settlementId: query.settlementId,
          sourceKind: row.sourceKind,
          paymentId: payment?.id,
          refundId: refund?.id,
          settlementRef,
          providerRowRef: row.rowRef,
          linkedToProcessorRef: row.linkedToProcessorRef,
          amount: row.amount,
          currency: row.currency === "USD" || row.currency === "CAD" ? row.currency : undefined,
          rawState: row.rawState,
          evidenceSource: row.evidenceSource,
          occurredAt: row.occurredAt,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await settlementLineageEntries.save(entry);
        entries.push(entry);
      }

      return {
        settlementId: query.settlementId,
        provider: providerContext.provider,
        considered: entries.length,
        resolvedPayments: entries.filter((entry) => entry.paymentId !== undefined).length,
        resolvedRefunds: entries.filter((entry) => entry.refundId !== undefined).length,
        unresolved: entries.filter((entry) => entry.paymentId === undefined && entry.refundId === undefined).length,
        entries,
      };
    },
  };
}
