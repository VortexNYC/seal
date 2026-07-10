import type { MerchantAccountId } from "../../domain/common";
import type { MerchantAccount, MerchantAccountStatus, MerchantMode } from "../../domain/merchant";
import type { CanonicalDomainEvent } from "../../events/types";
import type { MerchantAccountState } from "../../domain/state";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type {
  CreateMerchantAccountCommand,
  GetMerchantAccountQuery,
  ListMerchantAccountsQuery,
  MerchantAccountList,
  MerchantAccountSnapshot,
  UpdateMerchantAccountCommand,
} from "./contracts";
import type { MerchantAccountsService } from "./service";

export class MerchantAccountsServiceError extends Error {
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
    code: MerchantAccountsServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "MerchantAccountsServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface MerchantAccountsServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly now?: () => string;
  readonly createId?: (prefix: "ma") => string;
}

interface MerchantAccountsRuntime {
  readonly uow: PaymentsUnitOfWork;
  readonly now: () => string;
  readonly createId: (prefix: "ma") => string;
}

function createDefaultId(prefix: "ma"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createMerchantLocalEvent(input: {
  readonly id: string;
  readonly eventType: CanonicalDomainEvent["eventType"];
  readonly merchant: MerchantAccount;
  readonly occurredAt: string;
  readonly payload?: CanonicalDomainEvent["payload"];
}): CanonicalDomainEvent {
  return {
    id: input.id,
    environment: input.merchant.environment,
    eventType: input.eventType,
    aggregateType: "merchant_account",
    aggregateId: input.merchant.id,
    occurredAt: input.occurredAt,
    sourceProvider: "vortex",
    payload: {
      merchantAccountId: input.merchant.id,
      tenantId: input.merchant.tenantId,
      merchantStatus: input.merchant.status,
      ...input.payload,
    },
    createdAt: input.occurredAt,
  };
}

function maskLast4(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const digits = value.replace(/\D/gu, "");
  const source = digits.length > 0 ? digits : value;
  return `****${source.slice(-4)}`;
}

function toSnapshot(record: MerchantAccount): MerchantAccountSnapshot {
  const associatedIdentities = record.associatedIdentities ?? [];
  return {
    id: record.id,
    environment: record.environment,
    tenantId: record.tenantId,
    externalMerchantRef: record.externalMerchantRef,
    displayName: record.displayName,
    legalEntityType: record.legalEntityType,
    country: record.country,
    merchantMode: record.merchantMode,
    defaultCurrency: record.defaultCurrency,
    status: record.status,
    capabilityStatus: record.capabilityStatus,
    businessAddress: record.businessAddress,
    personalAddress: record.personalAddress,
    doingBusinessAs: record.doingBusinessAs,
    businessPhone: record.businessPhone,
    phone: record.phone,
    email: record.email,
    firstName: record.firstName,
    lastName: record.lastName,
    dateOfBirth: record.dateOfBirth,
    incorporationDate: record.incorporationDate,
    maxTransactionAmount: record.maxTransactionAmount,
    achMaxTransactionAmount: record.achMaxTransactionAmount,
    annualCardVolume: record.annualCardVolume,
    mcc: record.mcc,
    url: record.url,
    principalPercentageOwnership: record.principalPercentageOwnership,
    hasAcceptedCreditCardsPreviously: record.hasAcceptedCreditCardsPreviously,
    taxIdentity: {
      businessTaxIdMasked: maskLast4(record.businessTaxId),
      personalTaxIdMasked: maskLast4(record.taxId),
      associatedIdentityCount: associatedIdentities.length,
      beneficialOwnerCount: associatedIdentities.filter(
        (identity) => identity.relationType === "beneficial_owner",
      ).length,
      controlPersonCount: associatedIdentities.filter(
        (identity) => identity.relationType === "control_person",
      ).length,
      representativeCount: associatedIdentities.filter(
        (identity) => identity.relationType === "representative",
      ).length,
    },
    settlementAccount: {
      present: record.settlementBankAccount !== undefined,
      accountType: record.settlementBankAccount?.accountType,
      bankCode: record.settlementBankAccount?.bankCode,
      accountNumberMasked: maskLast4(record.settlementBankAccount?.accountNumber),
      name: record.settlementBankAccount?.name,
    },
    underwriting: record.underwriting,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function applyOptionalUpdate<T>(
  existing: T | undefined,
  next: T | null | undefined,
): T | undefined {
  if (next === undefined) {
    return existing;
  }
  if (next === null) {
    return undefined;
  }
  return next;
}

function createInitialMerchantState(
  merchantAccountId: MerchantAccountId,
  environment: MerchantAccount["environment"],
  merchantStatus: MerchantAccountStatus,
  generatedAt: string,
): MerchantAccountState {
  return {
    merchantAccountId,
    environment,
    merchantStatus,
    openRequirementIds: [],
    activeCapabilityKeys: [],
    restrictedCapabilityKeys: [],
    canAcceptPayments: false,
    payoutReadiness: "unknown",
    capabilitySnapshots: [],
    generatedAt,
  };
}

async function getMerchantOrThrow(
  uow: PaymentsUnitOfWork,
  environment: GetMerchantAccountQuery["environment"],
  merchantAccountId: MerchantAccountId,
): Promise<MerchantAccount> {
  const merchant = await uow.merchants.getById(merchantAccountId, { environment });
  if (!merchant) {
    throw new MerchantAccountsServiceError("not_found", "merchant account not found", {
      details: { merchantAccountId },
    });
  }
  return merchant;
}

async function createMerchantAccountSnapshot(
  runtime: MerchantAccountsRuntime,
  command: CreateMerchantAccountCommand,
): Promise<MerchantAccountSnapshot> {
  const createdAt = runtime.now();
  const merchant: MerchantAccount = {
    id: runtime.createId("ma"),
    environment: command.environment,
    tenantId: command.tenantId,
    externalMerchantRef: command.externalMerchantRef,
    displayName: command.displayName,
    legalEntityType: command.legalEntityType,
    country: command.country,
    merchantMode: command.merchantMode,
    defaultCurrency: command.defaultCurrency,
    status: "draft",
    capabilityStatus: "unknown",
    businessAddress: command.businessAddress,
    personalAddress: command.personalAddress,
    doingBusinessAs: command.doingBusinessAs,
    businessPhone: command.businessPhone,
    businessTaxId: command.businessTaxId,
    phone: command.phone,
    taxId: command.taxId,
    email: command.email,
    firstName: command.firstName,
    lastName: command.lastName,
    dateOfBirth: command.dateOfBirth,
    incorporationDate: command.incorporationDate,
    maxTransactionAmount: command.maxTransactionAmount,
    achMaxTransactionAmount: command.achMaxTransactionAmount,
    annualCardVolume: command.annualCardVolume,
    mcc: command.mcc,
    url: command.url,
    principalPercentageOwnership: command.principalPercentageOwnership,
    hasAcceptedCreditCardsPreviously: command.hasAcceptedCreditCardsPreviously,
    settlementBankAccount: command.settlementBankAccount,
    associatedIdentities: command.associatedIdentities,
    underwriting: command.underwriting,
    metadata: command.metadata,
    processorAccountRefs: [],
    createdAt,
    updatedAt: createdAt,
  };
  await runtime.uow.merchants.save(merchant);
  await runtime.uow.merchantStates.save(
    createInitialMerchantState(merchant.id, merchant.environment, merchant.status, createdAt),
  );
  await runtime.uow.events.saveCanonicalEvent(
    createMerchantLocalEvent({
      id: `${merchant.id}:merchant_account.created:${createdAt}`,
      eventType: "merchant_account.created",
      merchant,
      occurredAt: createdAt,
      payload: {
        displayName: merchant.displayName,
        merchantMode: merchant.merchantMode,
      },
    }),
  );
  return toSnapshot(merchant);
}

async function listMerchantAccountSnapshots(
  runtime: MerchantAccountsRuntime,
  query: ListMerchantAccountsQuery,
): Promise<MerchantAccountList> {
  const merchants = await runtime.uow.merchants.listByTenant(query.environment, query.tenantId);
  return [...merchants]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(toSnapshot);
}

async function getMerchantAccountSnapshot(
  runtime: MerchantAccountsRuntime,
  query: GetMerchantAccountQuery,
): Promise<MerchantAccountSnapshot | null> {
  const merchant = await runtime.uow.merchants.getById(query.merchantAccountId, {
    environment: query.environment,
  });
  return merchant ? toSnapshot(merchant) : null;
}

async function updateMerchantAccountSnapshot(
  runtime: MerchantAccountsRuntime,
  command: UpdateMerchantAccountCommand,
): Promise<MerchantAccountSnapshot> {
  const existing = await getMerchantOrThrow(
    runtime.uow,
    command.environment,
    command.merchantAccountId,
  );
  const updated: MerchantAccount = {
    ...existing,
    displayName: command.displayName ?? existing.displayName,
    merchantMode: (command.merchantMode ?? existing.merchantMode) as MerchantMode,
    businessAddress: applyOptionalUpdate(existing.businessAddress, command.businessAddress),
    personalAddress: applyOptionalUpdate(existing.personalAddress, command.personalAddress),
    doingBusinessAs: applyOptionalUpdate(existing.doingBusinessAs, command.doingBusinessAs),
    businessPhone: applyOptionalUpdate(existing.businessPhone, command.businessPhone),
    businessTaxId: applyOptionalUpdate(existing.businessTaxId, command.businessTaxId),
    phone: applyOptionalUpdate(existing.phone, command.phone),
    taxId: applyOptionalUpdate(existing.taxId, command.taxId),
    email: applyOptionalUpdate(existing.email, command.email),
    firstName: applyOptionalUpdate(existing.firstName, command.firstName),
    lastName: applyOptionalUpdate(existing.lastName, command.lastName),
    dateOfBirth: applyOptionalUpdate(existing.dateOfBirth, command.dateOfBirth),
    incorporationDate: applyOptionalUpdate(existing.incorporationDate, command.incorporationDate),
    maxTransactionAmount: applyOptionalUpdate(
      existing.maxTransactionAmount,
      command.maxTransactionAmount,
    ),
    achMaxTransactionAmount: applyOptionalUpdate(
      existing.achMaxTransactionAmount,
      command.achMaxTransactionAmount,
    ),
    annualCardVolume: applyOptionalUpdate(existing.annualCardVolume, command.annualCardVolume),
    mcc: applyOptionalUpdate(existing.mcc, command.mcc),
    url: applyOptionalUpdate(existing.url, command.url),
    principalPercentageOwnership: applyOptionalUpdate(
      existing.principalPercentageOwnership,
      command.principalPercentageOwnership,
    ),
    hasAcceptedCreditCardsPreviously: applyOptionalUpdate(
      existing.hasAcceptedCreditCardsPreviously,
      command.hasAcceptedCreditCardsPreviously,
    ),
    settlementBankAccount: applyOptionalUpdate(
      existing.settlementBankAccount,
      command.settlementBankAccount,
    ),
    associatedIdentities: applyOptionalUpdate(
      existing.associatedIdentities,
      command.associatedIdentities,
    ),
    underwriting: applyOptionalUpdate(existing.underwriting, command.underwriting),
    metadata: applyOptionalUpdate(existing.metadata, command.metadata),
    updatedAt: runtime.now(),
  };
  await runtime.uow.merchants.save(updated);
  await runtime.uow.events.saveCanonicalEvent(
    createMerchantLocalEvent({
      id: `${updated.id}:merchant_account.updated:${updated.updatedAt}`,
      eventType: "merchant_account.updated",
      merchant: updated,
      occurredAt: updated.updatedAt,
      payload: {
        displayName: updated.displayName,
        merchantMode: updated.merchantMode,
      },
    }),
  );
  return toSnapshot(updated);
}

export function createMerchantAccountsService(
  dependencies: MerchantAccountsServiceDependencies,
): MerchantAccountsService {
  const runtime: MerchantAccountsRuntime = {
    uow: dependencies.uow,
    now: dependencies.now ?? (() => new Date().toISOString()),
    createId: dependencies.createId ?? createDefaultId,
  };

  return {
    async createMerchantAccount(command) {
      return createMerchantAccountSnapshot(runtime, command);
    },
    async listMerchantAccounts(query) {
      return listMerchantAccountSnapshots(runtime, query);
    },
    async getMerchantAccount(query) {
      return getMerchantAccountSnapshot(runtime, query);
    },
    async updateMerchantAccount(command) {
      return updateMerchantAccountSnapshot(runtime, command);
    },
  };
}
