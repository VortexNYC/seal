import type {
  CanonicalDomainEventId,
  DisputeId,
  Environment,
  IdempotencyRecordId,
  MerchantAccountId,
  MerchantOnboardingSessionId,
  PaymentId,
  PaymentHardwareOrderId,
  PaymentHardwareSkuId,
  PaymentMethodSetupSessionId,
  PaymentIntentId,
  PayoutId,
  ProcessorEventId,
  RawProcessorWebhookId,
  RefundId,
  SettlementId,
} from "../domain/common";
import type { Dispute } from "../domain/disputes";
import type { SellerPayoutProfileSnapshot, Settlement, Payout, SettlementLineageEntry } from "../domain/funds";
import type { PaymentHardwareOrder, PaymentHardwareReturn, PaymentHardwareSku } from "../domain/hardware";
import type {
  MerchantAccount,
  MerchantOnboardingSession,
  MerchantRequirement,
  MerchantRequirementDocument,
} from "../domain/merchant";
import type { Payment, PaymentIntent, Refund } from "../domain/payments";
import type { CustomerProfile, PaymentMethod, PaymentMethodSetupSession } from "../domain/payment-methods";
import type { CanonicalDomainEvent, ProcessorEvent, RawProcessorWebhook } from "../events/types";
import type { OperatorCase, CaseActivity, CaseNote } from "../operators/cases";
import type { CustomerPaymentState, MerchantAccountState } from "../domain/state";
import type {
  CardPresentPaymentIntent,
  TerminalConnectionSession,
  TerminalLocation,
  TerminalReader,
} from "../domain/terminal";
import type { EventSubscription, WebhookDelivery, WebhookEndpoint } from "../domain/webhooks";

export interface RepositoryQueryOptions {
  readonly environment: Environment;
}

export interface MerchantAccountRepository {
  getById(id: MerchantAccountId, options: RepositoryQueryOptions): Promise<MerchantAccount | null>;
  listByTenant(
    environment: Environment,
    tenantId: string,
  ): Promise<readonly MerchantAccount[]>;
  getByProcessorRef(
    environment: Environment,
    provider: string,
    objectType: string,
    objectId: string,
  ): Promise<MerchantAccount | null>;
  save(record: MerchantAccount): Promise<void>;
}

export interface CustomerProfileRepository {
  getById(id: string, options: RepositoryQueryOptions): Promise<CustomerProfile | null>;
  save(record: CustomerProfile): Promise<void>;
}

export interface MerchantOnboardingRepository {
  getSessionById(
    id: MerchantOnboardingSessionId,
    options: RepositoryQueryOptions,
  ): Promise<MerchantOnboardingSession | null>;
  getLatestSessionByMerchantAccountId(
    merchantAccountId: MerchantAccountId,
    options: RepositoryQueryOptions,
  ): Promise<MerchantOnboardingSession | null>;
  listRequirementsForSession(
    onboardingSessionId: MerchantOnboardingSessionId,
    options: RepositoryQueryOptions,
  ): Promise<readonly MerchantRequirement[]>;
  listDocumentsForRequirement(
    requirementId: string,
    options: RepositoryQueryOptions,
  ): Promise<readonly MerchantRequirementDocument[]>;
  saveSession(record: MerchantOnboardingSession): Promise<void>;
  saveRequirement(record: MerchantRequirement): Promise<void>;
  saveRequirementDocument(record: MerchantRequirementDocument): Promise<void>;
}

export interface PaymentIntentRepository {
  getById(id: PaymentIntentId, options: RepositoryQueryOptions): Promise<PaymentIntent | null>;
  getByProcessorRef(
    environment: Environment,
    provider: string,
    objectType: string,
    objectId: string,
  ): Promise<PaymentIntent | null>;
  listByMerchant(
    environment: Environment,
    merchantAccountId: MerchantAccountId,
  ): Promise<readonly PaymentIntent[]>;
  listByCustomerProfile(
    environment: Environment,
    merchantAccountId: MerchantAccountId,
    customerProfileId: string,
  ): Promise<readonly PaymentIntent[]>;
  save(record: PaymentIntent): Promise<void>;
}

export interface PaymentRepository {
  getById(id: PaymentId, options: RepositoryQueryOptions): Promise<Payment | null>;
  getByPaymentIntentId(
    environment: Environment,
    paymentIntentId: PaymentIntentId,
  ): Promise<Payment | null>;
  getByProcessorRef?(
    environment: Environment,
    provider: string,
    objectType: string,
    objectId: string,
  ): Promise<Payment | null>;
  save(record: Payment): Promise<void>;
}

export interface RefundRepository {
  getById(id: RefundId, options: RepositoryQueryOptions): Promise<Refund | null>;
  getByProcessorRef(
    environment: Environment,
    provider: string,
    objectType: string,
    objectId: string,
  ): Promise<Refund | null>;
  listByPayment(
    environment: Environment,
    paymentId: PaymentId,
  ): Promise<readonly Refund[]>;
  save(record: Refund): Promise<void>;
}

export interface SettlementRepository {
  getById(id: SettlementId, options: RepositoryQueryOptions): Promise<Settlement | null>;
  getByProcessorRef(
    environment: Environment,
    provider: string,
    objectType: string,
    objectId: string,
  ): Promise<Settlement | null>;
  listByMerchant(
    environment: Environment,
    merchantAccountId: MerchantAccountId,
  ): Promise<readonly Settlement[]>;
  save(record: Settlement): Promise<void>;
}

export interface PayoutRepository {
  getById(id: PayoutId, options: RepositoryQueryOptions): Promise<Payout | null>;
  getByProcessorRef(
    environment: Environment,
    provider: string,
    objectType: string,
    objectId: string,
  ): Promise<Payout | null>;
  listByMerchant(
    environment: Environment,
    merchantAccountId: MerchantAccountId,
  ): Promise<readonly Payout[]>;
  save(record: Payout): Promise<void>;
}

export interface SettlementLineageEntryRepository {
  getByProviderRowRef(
    environment: Environment,
    provider: string,
    objectType: string,
    objectId: string,
  ): Promise<SettlementLineageEntry | null>;
  listBySettlement(
    environment: Environment,
    settlementId: SettlementId,
  ): Promise<readonly SettlementLineageEntry[]>;
  save(record: SettlementLineageEntry): Promise<void>;
}

export interface SellerPayoutProfileSnapshotRepository {
  listByMerchant(
    environment: Environment,
    merchantAccountId: MerchantAccountId,
    limit?: number,
  ): Promise<readonly SellerPayoutProfileSnapshot[]>;
  save(record: SellerPayoutProfileSnapshot): Promise<void>;
}

export interface DisputeRepository {
  getById(id: DisputeId, options: RepositoryQueryOptions): Promise<Dispute | null>;
  getByProcessorRef(
    environment: Environment,
    provider: string,
    objectType: string,
    objectId: string,
  ): Promise<Dispute | null>;
  listByMerchant(
    environment: Environment,
    merchantAccountId: MerchantAccountId,
  ): Promise<readonly Dispute[]>;
  save(record: Dispute): Promise<void>;
}

export interface TerminalLocationRepository {
  getById(id: string, options: RepositoryQueryOptions): Promise<TerminalLocation | null>;
  listByMerchant(environment: Environment, merchantAccountId: MerchantAccountId): Promise<readonly TerminalLocation[]>;
  save(record: TerminalLocation): Promise<void>;
}

export interface TerminalReaderRepository {
  getById(id: string, options: RepositoryQueryOptions): Promise<TerminalReader | null>;
  listByMerchant(environment: Environment, merchantAccountId: MerchantAccountId): Promise<readonly TerminalReader[]>;
  listByLocation(environment: Environment, merchantAccountId: MerchantAccountId, locationId: string): Promise<readonly TerminalReader[]>;
  save(record: TerminalReader): Promise<void>;
}

export interface TerminalConnectionSessionRepository {
  getById(id: string, options: RepositoryQueryOptions): Promise<TerminalConnectionSession | null>;
  listByMerchant(environment: Environment, merchantAccountId: MerchantAccountId): Promise<readonly TerminalConnectionSession[]>;
  save(record: TerminalConnectionSession): Promise<void>;
}

export interface CardPresentPaymentIntentRepository {
  getById(id: string, options: RepositoryQueryOptions): Promise<CardPresentPaymentIntent | null>;
  listByMerchant(environment: Environment, merchantAccountId: MerchantAccountId): Promise<readonly CardPresentPaymentIntent[]>;
  save(record: CardPresentPaymentIntent): Promise<void>;
}

export interface PaymentHardwareSkuRepository {
  getById(id: PaymentHardwareSkuId, options: RepositoryQueryOptions): Promise<PaymentHardwareSku | null>;
  getBySkuCode(environment: Environment, skuCode: string): Promise<PaymentHardwareSku | null>;
  list(environment: Environment): Promise<readonly PaymentHardwareSku[]>;
  save(record: PaymentHardwareSku): Promise<void>;
}

export interface PaymentHardwareOrderRepository {
  getById(id: PaymentHardwareOrderId, options: RepositoryQueryOptions): Promise<PaymentHardwareOrder | null>;
  listByMerchant(environment: Environment, merchantAccountId: MerchantAccountId): Promise<readonly PaymentHardwareOrder[]>;
  save(record: PaymentHardwareOrder): Promise<void>;
}

export interface PaymentHardwareReturnRepository {
  listByOrder(environment: Environment, orderId: PaymentHardwareOrderId): Promise<readonly PaymentHardwareReturn[]>;
  save(record: PaymentHardwareReturn): Promise<void>;
}

export interface MerchantStateRepository {
  getByMerchantAccountId(
    merchantAccountId: MerchantAccountId,
    options: RepositoryQueryOptions,
  ): Promise<MerchantAccountState | null>;
  save(record: MerchantAccountState): Promise<void>;
}

export interface PaymentMethodRepository {
  getById(id: string, options: RepositoryQueryOptions): Promise<PaymentMethod | null>;
  getByProcessorRef(
    environment: Environment,
    provider: string,
    objectType: string,
    objectId: string,
  ): Promise<PaymentMethod | null>;
  listByOwner(
    environment: Environment,
    ownerType: PaymentMethod["ownerType"],
    ownerId: string,
  ): Promise<readonly PaymentMethod[]>;
  save(record: PaymentMethod): Promise<void>;
}

export interface PaymentMethodSetupSessionRepository {
  getById(
    id: PaymentMethodSetupSessionId,
    options: RepositoryQueryOptions,
  ): Promise<PaymentMethodSetupSession | null>;
  save(record: PaymentMethodSetupSession): Promise<void>;
}

export interface CustomerStateRepository {
  getByMerchantAndCustomer(
    environment: Environment,
    merchantAccountId: MerchantAccountId,
    customerProfileId: string,
  ): Promise<CustomerPaymentState | null>;
  save(record: CustomerPaymentState): Promise<void>;
}

export interface EventRepository {
  getRawWebhookById(
    id: RawProcessorWebhookId,
    options: RepositoryQueryOptions,
  ): Promise<RawProcessorWebhook | null>;
  getRawWebhookByDeliveryKey(
    environment: Environment,
    provider: string,
    deliveryKey: string,
  ): Promise<RawProcessorWebhook | null>;
  saveRawWebhook(record: RawProcessorWebhook): Promise<void>;
  getProcessorEventById(id: ProcessorEventId, options: RepositoryQueryOptions): Promise<ProcessorEvent | null>;
  saveProcessorEvent(record: ProcessorEvent): Promise<void>;
  saveCanonicalEvent(record: CanonicalDomainEvent): Promise<void>;
  getCanonicalEventById(
    id: CanonicalDomainEventId,
    options: RepositoryQueryOptions,
  ): Promise<CanonicalDomainEvent | null>;
  getWebhookEndpointById(id: string, options: RepositoryQueryOptions): Promise<WebhookEndpoint | null>;
  saveWebhookEndpoint(record: WebhookEndpoint): Promise<void>;
  saveWebhookDelivery(record: WebhookDelivery): Promise<void>;
  saveEventSubscription(record: EventSubscription): Promise<void>;
}

export interface OperatorCaseRepository {
  getById(id: string, options: RepositoryQueryOptions): Promise<OperatorCase | null>;
  save(record: OperatorCase): Promise<void>;
  saveActivity(record: CaseActivity): Promise<void>;
  saveNote(record: CaseNote): Promise<void>;
}

export interface IdempotencyRecord {
  readonly id: IdempotencyRecordId;
  readonly environment: Environment;
  readonly scope: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly responseRef: string;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

export interface IdempotencyRepository {
  getByScopeAndKey(
    environment: Environment,
    scope: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecord | null>;
  save(record: IdempotencyRecord): Promise<void>;
}
