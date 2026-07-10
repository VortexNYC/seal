import type { ProcessorRef } from "../../domain/common";
import type { MerchantAccount } from "../../domain/merchant";
import type { Settlement, SettlementLineageEntry } from "../../domain/funds";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type { SettlementLineageEntryRepository } from "../../storage/repositories";
import type { ProviderRegistry } from "../../providers/registry";
import type {
  PaymentsProviderAdapter,
  ProviderContext,
  ProviderSettlementLineageRow,
} from "../../providers/types";
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

function createLineageEntryId(
  settlementId: string,
  rowRef: SettlementLineageEntry["providerRowRef"],
): string {
  return `${settlementId}:${rowRef.objectType}:${rowRef.objectId}`;
}

interface SettlementLineageRuntime {
  readonly uow: PaymentsUnitOfWork;
  readonly providers: ProviderRegistry;
  readonly resolveProviderContext: (merchant: MerchantAccount) => ProviderContext;
  readonly now: () => string;
}

type ListSettlementLineage = NonNullable<PaymentsProviderAdapter["listSettlementLineage"]>;

function requireSettlementLineageEntries(
  uow: PaymentsUnitOfWork,
): SettlementLineageEntryRepository {
  const settlementLineageEntries = uow.settlementLineageEntries;
  if (!settlementLineageEntries) {
    throw new Error("settlement lineage repository is not configured");
  }
  return settlementLineageEntries;
}

async function getSettlementInScope(
  runtime: SettlementLineageRuntime,
  query: SyncSettlementLineageQuery,
): Promise<Settlement | null> {
  const settlement = await runtime.uow.settlements.getById(query.settlementId, {
    environment: query.environment,
  });
  if (!settlement || settlement.merchantAccountId !== query.merchantAccountId) {
    return null;
  }
  return settlement;
}

function getSettlementRefOrThrow(
  settlement: Settlement,
  query: SyncSettlementLineageQuery,
): ProcessorRef {
  const settlementRef =
    settlement.processorRefs.find((ref) => ref.relationship === "settlement") ??
    settlement.processorRefs[0] ??
    null;
  if (!settlementRef) {
    throw new Error(`settlement ${query.settlementId} is missing processor settlement reference`);
  }
  return settlementRef;
}

async function getProviderContextInScope(
  runtime: SettlementLineageRuntime,
  query: SyncSettlementLineageQuery,
): Promise<ProviderContext | null> {
  const merchant = await runtime.uow.merchants.getById(query.merchantAccountId, {
    environment: query.environment,
  });
  if (!merchant) {
    return null;
  }
  return runtime.resolveProviderContext(merchant);
}

function getLineageFetcherOrThrow(
  adapter: PaymentsProviderAdapter,
  providerContext: ProviderContext,
): ListSettlementLineage {
  const listSettlementLineage = adapter.listSettlementLineage;
  if (!listSettlementLineage) {
    throw new Error(`provider ${providerContext.provider} does not support settlement lineage`);
  }
  return listSettlementLineage;
}

async function listProviderSettlementRows(
  runtime: SettlementLineageRuntime,
  providerContext: ProviderContext,
  settlementRef: ProcessorRef,
): Promise<readonly ProviderSettlementLineageRow[]> {
  const adapter = runtime.providers.getAdapter(providerContext.provider);
  const listSettlementLineage = getLineageFetcherOrThrow(adapter, providerContext);
  const listed = await listSettlementLineage(providerContext, { settlementRef });
  if (!listed.ok) {
    throw new Error(listed.error?.message ?? "provider settlement lineage unavailable");
  }
  return listed.value?.items ?? [];
}

async function createLineageEntryFromRow(
  runtime: SettlementLineageRuntime,
  query: SyncSettlementLineageQuery,
  settlementRef: ProcessorRef,
  row: ProviderSettlementLineageRow,
): Promise<SettlementLineageEntry> {
  const [payment, refund] = await Promise.all([
    runtime.uow.payments.getByProcessorRef?.(
      query.environment,
      row.rowRef.provider,
      row.rowRef.objectType,
      row.rowRef.objectId,
    ) ?? Promise.resolve(null),
    runtime.uow.refunds.getByProcessorRef(
      query.environment,
      row.rowRef.provider,
      row.rowRef.objectType,
      row.rowRef.objectId,
    ),
  ]);
  const timestamp = runtime.now();
  return {
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
}

async function saveLineageEntries(
  runtime: SettlementLineageRuntime,
  settlementLineageEntries: SettlementLineageEntryRepository,
  query: SyncSettlementLineageQuery,
  settlementRef: ProcessorRef,
  rows: readonly ProviderSettlementLineageRow[],
): Promise<readonly SettlementLineageEntry[]> {
  const entries: SettlementLineageEntry[] = [];
  for (const row of rows) {
    const entry = await createLineageEntryFromRow(runtime, query, settlementRef, row);
    await settlementLineageEntries.save(entry);
    entries.push(entry);
  }
  return entries;
}

function summarizeLineageEntries(
  query: SyncSettlementLineageQuery,
  providerContext: ProviderContext,
  entries: readonly SettlementLineageEntry[],
): SyncSettlementLineageResult {
  return {
    settlementId: query.settlementId,
    provider: providerContext.provider,
    considered: entries.length,
    resolvedPayments: entries.filter((entry) => entry.paymentId !== undefined).length,
    resolvedRefunds: entries.filter((entry) => entry.refundId !== undefined).length,
    unresolved: entries.filter(
      (entry) => entry.paymentId === undefined && entry.refundId === undefined,
    ).length,
    entries,
  };
}

async function syncSettlementLineage(
  runtime: SettlementLineageRuntime,
  query: SyncSettlementLineageQuery,
): Promise<SyncSettlementLineageResult | null> {
  const settlementLineageEntries = requireSettlementLineageEntries(runtime.uow);
  const settlement = await getSettlementInScope(runtime, query);
  if (!settlement) {
    return null;
  }
  const providerContext = await getProviderContextInScope(runtime, query);
  if (!providerContext) {
    return null;
  }

  const settlementRef = getSettlementRefOrThrow(settlement, query);
  const rows = await listProviderSettlementRows(runtime, providerContext, settlementRef);
  const entries = await saveLineageEntries(
    runtime,
    settlementLineageEntries,
    query,
    settlementRef,
    rows,
  );
  return summarizeLineageEntries(query, providerContext, entries);
}

export function createSettlementLineageService(
  dependencies: SettlementLineageServiceDependencies,
): SettlementLineageService {
  const runtime: SettlementLineageRuntime = {
    uow: dependencies.uow,
    providers: dependencies.providers,
    resolveProviderContext: dependencies.resolveProviderContext,
    now: dependencies.now ?? defaultNow,
  };

  return {
    async syncSettlementLineage(
      query: SyncSettlementLineageQuery,
    ): Promise<SyncSettlementLineageResult | null> {
      return syncSettlementLineage(runtime, query);
    },
  };
}
