export const aggregateNames = {
  platformTenant: "PlatformTenant",
  merchantAccount: "MerchantAccount",
  merchantOnboardingSession: "MerchantOnboardingSession",
  merchantRequirement: "MerchantRequirement",
  merchantCapability: "MerchantCapability",
  customerProfile: "CustomerProfile",
  paymentMethod: "PaymentMethod",
  paymentMethodSetupSession: "PaymentMethodSetupSession",
  payoutAccount: "PayoutAccount",
  paymentIntent: "PaymentIntent",
  payment: "Payment",
  refund: "Refund",
  settlement: "Settlement",
  payout: "Payout",
  dispute: "Dispute",
  terminalSession: "TerminalSession",
  rawProcessorWebhook: "RawProcessorWebhook",
  processorEvent: "ProcessorEvent",
  canonicalDomainEvent: "CanonicalDomainEvent",
  webhookEndpoint: "WebhookEndpoint",
  webhookDelivery: "WebhookDelivery",
  eventSubscription: "EventSubscription",
  merchantAccountState: "MerchantAccountState",
  auditEvent: "AuditEvent",
  operatorCase: "Case",
  caseActivity: "CaseActivity",
  caseNote: "CaseNote",
  idempotencyRecord: "IdempotencyRecord",
  notificationDelivery: "NotificationDelivery",
  reconciliationRun: "ReconciliationRun",
} as const;

export type AggregateName = (typeof aggregateNames)[keyof typeof aggregateNames];

export interface IndexDefinition {
  readonly aggregate: AggregateName;
  readonly fields: readonly string[];
  readonly unique?: boolean;
}

export interface AggregateDefinition {
  readonly name: AggregateName;
  readonly category: "canonical" | "events" | "operations";
  readonly primaryKey: string;
}

export const aggregateDefinitions: readonly AggregateDefinition[] = [
  { name: aggregateNames.platformTenant, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.merchantAccount, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.merchantOnboardingSession, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.merchantRequirement, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.merchantCapability, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.customerProfile, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.paymentMethod, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.paymentMethodSetupSession, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.payoutAccount, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.paymentIntent, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.payment, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.refund, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.settlement, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.payout, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.dispute, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.terminalSession, category: "canonical", primaryKey: "id" },
  { name: aggregateNames.rawProcessorWebhook, category: "events", primaryKey: "id" },
  { name: aggregateNames.processorEvent, category: "events", primaryKey: "id" },
  { name: aggregateNames.canonicalDomainEvent, category: "events", primaryKey: "id" },
  { name: aggregateNames.webhookEndpoint, category: "events", primaryKey: "id" },
  { name: aggregateNames.webhookDelivery, category: "events", primaryKey: "id" },
  { name: aggregateNames.eventSubscription, category: "events", primaryKey: "id" },
  {
    name: aggregateNames.merchantAccountState,
    category: "canonical",
    primaryKey: "merchantAccountId",
  },
  { name: aggregateNames.auditEvent, category: "operations", primaryKey: "id" },
  { name: aggregateNames.operatorCase, category: "operations", primaryKey: "id" },
  { name: aggregateNames.caseActivity, category: "operations", primaryKey: "id" },
  { name: aggregateNames.caseNote, category: "operations", primaryKey: "id" },
  { name: aggregateNames.idempotencyRecord, category: "operations", primaryKey: "id" },
  { name: aggregateNames.notificationDelivery, category: "operations", primaryKey: "id" },
  { name: aggregateNames.reconciliationRun, category: "operations", primaryKey: "id" },
] as const;

export const baseIndexes: readonly IndexDefinition[] = [
  { aggregate: aggregateNames.merchantAccount, fields: ["environment", "tenantId"] },
  {
    aggregate: aggregateNames.merchantAccountState,
    fields: ["environment", "merchantStatus", "payoutReadiness"],
  },
  {
    aggregate: aggregateNames.paymentMethodSetupSession,
    fields: ["environment", "merchantAccountId", "ownerType", "ownerId", "status"],
  },
  {
    aggregate: aggregateNames.paymentIntent,
    fields: ["environment", "merchantAccountId", "status"],
  },
  { aggregate: aggregateNames.payment, fields: ["environment", "merchantAccountId", "status"] },
  { aggregate: aggregateNames.refund, fields: ["environment", "paymentId"] },
  { aggregate: aggregateNames.settlement, fields: ["environment", "merchantAccountId", "status"] },
  { aggregate: aggregateNames.payout, fields: ["environment", "merchantAccountId", "status"] },
  { aggregate: aggregateNames.dispute, fields: ["environment", "merchantAccountId", "deadlineAt"] },
  { aggregate: aggregateNames.operatorCase, fields: ["environment", "caseType", "status"] },
  {
    aggregate: aggregateNames.operatorCase,
    fields: ["environment", "assignment.queueKey", "status"],
  },
  {
    aggregate: aggregateNames.canonicalDomainEvent,
    fields: ["environment", "aggregateType", "aggregateId"],
  },
  {
    aggregate: aggregateNames.rawProcessorWebhook,
    fields: ["environment", "provider", "deliveryKey"],
    unique: true,
  },
  {
    aggregate: aggregateNames.processorEvent,
    fields: ["environment", "provider", "processorEntityType", "processorObjectId"],
  },
  {
    aggregate: aggregateNames.webhookEndpoint,
    fields: ["environment", "status"],
  },
  {
    aggregate: aggregateNames.webhookDelivery,
    fields: ["environment", "endpointId", "status", "nextAttemptAt"],
  },
  {
    aggregate: aggregateNames.eventSubscription,
    fields: ["environment", "endpointId", "eventType"],
    unique: true,
  },
  {
    aggregate: aggregateNames.auditEvent,
    fields: ["environment", "targetType", "targetId"],
  },
  {
    aggregate: aggregateNames.idempotencyRecord,
    fields: ["environment", "scope", "idempotencyKey"],
    unique: true,
  },
  {
    aggregate: aggregateNames.notificationDelivery,
    fields: ["environment", "status", "relatedObjectType", "relatedObjectId"],
  },
  {
    aggregate: aggregateNames.reconciliationRun,
    fields: ["environment", "provider", "runType", "startedAt"],
  },
] as const;
