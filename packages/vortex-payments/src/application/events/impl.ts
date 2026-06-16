import type { Payout, PayoutStatus, Settlement, SettlementStatus } from "../../domain/funds";
import type { MerchantAccountStatus, MerchantOnboardingSession } from "../../domain/merchant";
import type { Dispute } from "../../domain/disputes";
import type { PaymentMethod } from "../../domain/payment-methods";
import type { Payment, PaymentIntent, PaymentIntentStatus, Refund, RefundStatus } from "../../domain/payments";
import type { CanonicalDomainEvent } from "../../events/types";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { rebuildAndSaveCustomerPaymentState } from "../state/rebuild-customer-payment-state";
import { deriveMerchantAccountState } from "../state/derive-merchant-account-state";
import type { CanonicalEventsService } from "./service";

export interface CanonicalEventsServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
}

function mapMerchantStatus(eventType: CanonicalDomainEvent["eventType"]): MerchantAccountStatus | null {
  switch (eventType) {
    case "merchant_account.approved":
      return "active";
    case "merchant_account.rejected":
      return "rejected";
    case "merchant_account.action_required":
    case "merchant_account.restricted":
      return "restricted";
    case "merchant_account.submitted":
      return "pending_review";
    default:
      return null;
  }
}

function mapOnboardingStatus(eventType: CanonicalDomainEvent["eventType"]): MerchantOnboardingSession["status"] | null {
  switch (eventType) {
    case "merchant_account.approved":
      return "approved";
    case "merchant_account.rejected":
      return "rejected";
    case "merchant_account.action_required":
      return "action_required";
    case "merchant_account.restricted":
      return "restricted";
    case "merchant_account.submitted":
      return "submitted";
    default:
      return null;
  }
}

function mapPaymentIntentStatus(eventType: CanonicalDomainEvent["eventType"]): PaymentIntentStatus | null {
  switch (eventType) {
    case "payment.authorized":
      return "authorized";
    case "payment.captured":
      return "captured";
    case "payment.failed":
      return "failed";
    case "payment.canceled":
      return "canceled";
    default:
      return null;
  }
}

function mapRefundStatus(eventType: CanonicalDomainEvent["eventType"]): RefundStatus | null {
  switch (eventType) {
    case "refund.created":
      return "pending";
    case "refund.succeeded":
      return "succeeded";
    case "refund.failed":
      return "failed";
    default:
      return null;
  }
}

function isTerminalPaymentIntentStatus(status: PaymentIntentStatus): boolean {
  return status === "captured" || status === "failed" || status === "canceled";
}

function isTerminalRefundStatus(status: RefundStatus): boolean {
  return status === "succeeded" || status === "failed";
}

function isTerminalSettlementStatus(status: SettlementStatus): boolean {
  return status === "closed";
}

function isTerminalPayoutStatus(status: PayoutStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "returned";
}

function payloadString(
  payload: CanonicalDomainEvent["payload"],
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

function payloadNumber(
  payload: CanonicalDomainEvent["payload"],
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function payloadCurrency(payload: CanonicalDomainEvent["payload"]): Settlement["currency"] | null {
  const value = payloadString(payload, ["currency"]);
  if (value === "USD" || value === "CAD") {
    return value;
  }
  return null;
}

function payloadDirection(
  payload: CanonicalDomainEvent["payload"],
  fallback: Settlement["direction"],
): Settlement["direction"] {
  const value = payloadString(payload, ["direction"]);
  return value === "credit" || value === "debit" ? value : fallback;
}

function eventObjectType(event: CanonicalDomainEvent, fallback: string): string {
  return payloadString(event.payload, ["objectType", "object_type"]) ?? fallback;
}

function settlementIdForProviderObject(event: CanonicalDomainEvent, providerObjectId: string): Settlement["id"] {
  return `settlement_${event.sourceProvider}_${providerObjectId}`;
}

function payoutIdForProviderObject(event: CanonicalDomainEvent, providerObjectId: string): Payout["id"] {
  return `payout_${event.sourceProvider}_${providerObjectId}`;
}

async function resolveFundsMerchantAccountId(
  uow: PaymentsUnitOfWork,
  event: CanonicalDomainEvent,
): Promise<Settlement["merchantAccountId"] | null> {
  const directMerchantAccountId = payloadString(event.payload, [
    "merchantAccountId",
    "merchant_account_id",
    "merchantAccount",
    "merchant_account",
  ]);
  if (directMerchantAccountId !== null) {
    return directMerchantAccountId;
  }

  const processorMerchantId = payloadString(event.payload, [
    "merchant",
    "merchant_id",
    "merchantIdentityId",
    "merchant_identity_id",
    "identity",
    "identity_id",
  ]);
  if (processorMerchantId === null) {
    return null;
  }

  const merchant =
    await uow.merchants.getByProcessorRef(event.environment, event.sourceProvider, "merchant", processorMerchantId) ??
    await uow.merchants.getByProcessorRef(event.environment, event.sourceProvider, "identity", processorMerchantId);
  return merchant?.id ?? null;
}

function sumSucceededRefundAmount(refunds: readonly Refund[]): number {
  return refunds.reduce((total, refund) => {
    return refund.status === "succeeded" ? total + refund.amount : total;
  }, 0);
}

function derivePaymentStatusAfterRefunds(payment: Payment, refunds: readonly Refund[]): Payment["status"] {
  const refundedAmount = sumSucceededRefundAmount(refunds);
  if (refundedAmount >= payment.amount) {
    return "refunded_full";
  }
  if (refundedAmount > 0) {
    return "refunded_partial";
  }
  return payment.status;
}

function mapSettlementStatus(eventType: CanonicalDomainEvent["eventType"]): SettlementStatus | null {
  switch (eventType) {
    case "settlement.accruing_started":
      return "accruing";
    case "settlement.closed":
      return "closed";
    default:
      return null;
  }
}

function mapPayoutStatus(eventType: CanonicalDomainEvent["eventType"]): PayoutStatus | null {
  switch (eventType) {
    case "payout.created":
      return "pending";
    case "payout.succeeded":
      return "succeeded";
    case "payout.failed":
      return "failed";
    case "payout.returned":
      return "returned";
    default:
      return null;
  }
}

function mapDisputeState(eventType: CanonicalDomainEvent["eventType"]): Pick<Dispute, "stage" | "responseState"> | null {
  switch (eventType) {
    case "dispute.opened":
      return { stage: "chargeback", responseState: "needs_response" };
    case "dispute.action_required":
      return { stage: "review", responseState: "needs_response" };
    case "dispute.won":
      return { stage: "won", responseState: "closed" };
    case "dispute.lost":
      return { stage: "lost", responseState: "closed" };
    default:
      return null;
  }
}

async function applyMerchantEvent(
  uow: PaymentsUnitOfWork,
  event: CanonicalDomainEvent,
): Promise<void> {
  const merchantStatus = mapMerchantStatus(event.eventType);
  if (!merchantStatus) {
    return;
  }

  const merchant = await uow.merchants.getByProcessorRef(
    event.environment,
    event.sourceProvider,
    "merchant",
    event.aggregateId,
  );
  if (!merchant) {
    return;
  }

  const latestSession = await uow.onboarding.getLatestSessionByMerchantAccountId(merchant.id, {
    environment: event.environment,
  });
  const requirements = latestSession
    ? await uow.onboarding.listRequirementsForSession(latestSession.id, {
      environment: event.environment,
    })
    : [];
  const sessionStatus = mapOnboardingStatus(event.eventType);
  const updatedSession = latestSession && sessionStatus
    ? {
      ...latestSession,
      status: sessionStatus,
      approvedAt: sessionStatus === "approved" ? event.occurredAt : latestSession.approvedAt,
      rejectedAt: sessionStatus === "rejected" ? event.occurredAt : latestSession.rejectedAt,
      updatedAt: event.occurredAt,
    }
    : latestSession;

  const updatedMerchant = {
    ...merchant,
    status: merchantStatus,
    updatedAt: event.occurredAt,
  };
  await uow.merchants.save(updatedMerchant);
  if (updatedSession) {
    await uow.onboarding.saveSession(updatedSession);
  }
  await uow.merchantStates.save(
    deriveMerchantAccountState({
      merchant: updatedMerchant,
      onboardingSession: updatedSession,
      requirements,
      generatedAt: event.occurredAt,
    }),
  );
}

async function applyPaymentEvent(
  uow: PaymentsUnitOfWork,
  event: CanonicalDomainEvent,
): Promise<void> {
  const status = mapPaymentIntentStatus(event.eventType);
  if (!status) {
    return;
  }

  const paymentIntent = await uow.paymentIntents.getByProcessorRef(
    event.environment,
    event.sourceProvider,
    event.payload.objectType && typeof event.payload.objectType === "string" ? event.payload.objectType : "transfer",
    event.aggregateId,
  );
  if (!paymentIntent) {
    return;
  }

  if (isTerminalPaymentIntentStatus(paymentIntent.status) && paymentIntent.status !== status) {
    return;
  }

  const updated: PaymentIntent = {
    ...paymentIntent,
    status,
    nextActionType: status === "requires_action" ? paymentIntent.nextActionType : undefined,
    hostedActionUrl: status === "requires_action" ? paymentIntent.hostedActionUrl : undefined,
    confirmedAt: status === "authorized" || status === "captured" ? event.occurredAt : paymentIntent.confirmedAt,
    canceledAt: status === "canceled" ? event.occurredAt : paymentIntent.canceledAt,
    updatedAt: event.occurredAt,
  };
  await uow.paymentIntents.save(updated);

  if (updated.customerProfileId) {
    await rebuildAndSaveCustomerPaymentState(uow, {
      environment: updated.environment,
      merchantAccountId: updated.merchantAccountId,
      customerProfileId: updated.customerProfileId,
      generatedAt: event.occurredAt,
    });
  }
}

function mapPaymentMethodStatusFromPayload(
  payload: CanonicalDomainEvent["payload"],
): PaymentMethod["status"] {
  if (payload.enabled === true) {
    return "active";
  }
  if (payload.disabled_code === "ARCHIVED") {
    return "archived";
  }
  return "disabled";
}

async function applyPaymentMethodEvent(
  uow: PaymentsUnitOfWork,
  event: CanonicalDomainEvent,
): Promise<void> {
  const paymentMethod = await uow.paymentMethods.getByProcessorRef(
    event.environment,
    event.sourceProvider,
    event.payload.objectType && typeof event.payload.objectType === "string"
      ? event.payload.objectType
      : "payment_instrument",
    event.aggregateId,
  );
  if (!paymentMethod) {
    return;
  }

  const nextStatus = mapPaymentMethodStatusFromPayload(event.payload);
  const updated: PaymentMethod = {
    ...paymentMethod,
    status: nextStatus,
    isDefault: nextStatus === "active" ? paymentMethod.isDefault : false,
    updatedAt: event.occurredAt,
    archivedAt: nextStatus === "archived" ? event.occurredAt : paymentMethod.archivedAt,
  };
  await uow.paymentMethods.save(updated);

  if (updated.ownerType === "customer" && updated.merchantAccountId) {
    await rebuildAndSaveCustomerPaymentState(uow, {
      environment: updated.environment,
      merchantAccountId: updated.merchantAccountId,
      customerProfileId: updated.ownerId,
      generatedAt: event.occurredAt,
    });
  }
}

async function applyRefundEvent(
  uow: PaymentsUnitOfWork,
  event: CanonicalDomainEvent,
): Promise<void> {
  const status = mapRefundStatus(event.eventType);
  if (!status) {
    return;
  }

  const refund = await uow.refunds.getByProcessorRef(
    event.environment,
    event.sourceProvider,
    event.payload.objectType && typeof event.payload.objectType === "string" ? event.payload.objectType : "transfer",
    event.aggregateId,
  );
  if (!refund) {
    return;
  }

  if (isTerminalRefundStatus(refund.status) && refund.status !== status) {
    return;
  }

  const updated: Refund = {
    ...refund,
    status,
    updatedAt: event.occurredAt,
  };
  await uow.refunds.save(updated);

  const payment = await uow.payments.getById(refund.paymentId, { environment: event.environment });
  if (!payment) {
    return;
  }

  const refunds = await uow.refunds.listByPayment(event.environment, refund.paymentId);
  await uow.payments.save({
    ...payment,
    status: derivePaymentStatusAfterRefunds(
      payment,
      refunds.map((entry) => (entry.id === updated.id ? updated : entry)),
    ),
    updatedAt: event.occurredAt,
  });
}

async function applySettlementEvent(
  uow: PaymentsUnitOfWork,
  event: CanonicalDomainEvent,
): Promise<void> {
  const status = mapSettlementStatus(event.eventType);
  if (!status) {
    return;
  }

  const settlement = await uow.settlements.getByProcessorRef(
    event.environment,
    event.sourceProvider,
    eventObjectType(event, "settlement"),
    event.aggregateId,
  );
  if (!settlement) {
    const merchantAccountId = await resolveFundsMerchantAccountId(uow, event);
    const currency = payloadCurrency(event.payload);
    if (merchantAccountId === null || currency === null) {
      return;
    }

    const created: Settlement = {
      id: settlementIdForProviderObject(event, event.aggregateId),
      environment: event.environment,
      merchantAccountId,
      currency,
      status,
      grossAmount: payloadNumber(event.payload, ["grossAmount", "gross_amount", "gross"]) ?? 0,
      feeAmount: payloadNumber(event.payload, ["feeAmount", "fee_amount", "fee", "fees"]) ?? 0,
      refundAmount: payloadNumber(event.payload, ["refundAmount", "refund_amount", "refunds"]) ?? 0,
      adjustmentAmount: payloadNumber(event.payload, ["adjustmentAmount", "adjustment_amount", "adjustment", "adjustments"]) ?? 0,
      netAmount: payloadNumber(event.payload, ["netAmount", "net_amount", "net"]) ?? 0,
      direction: payloadDirection(event.payload, "credit"),
      openedAt: status === "accruing" ? event.occurredAt : undefined,
      closedAt: status === "closed" ? event.occurredAt : undefined,
      processorRefs: [{
        provider: event.sourceProvider,
        objectType: eventObjectType(event, "settlement"),
        objectId: event.aggregateId,
        relationship: "settlement",
        recordedAt: event.occurredAt,
      }],
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
    };
    await uow.settlements.save(created);
    return;
  }

  if (isTerminalSettlementStatus(settlement.status) && settlement.status !== status) {
    return;
  }

  const updated: Settlement = {
    ...settlement,
    status,
    grossAmount: payloadNumber(event.payload, ["grossAmount", "gross_amount", "gross"]) ?? settlement.grossAmount,
    feeAmount: payloadNumber(event.payload, ["feeAmount", "fee_amount", "fee", "fees"]) ?? settlement.feeAmount,
    refundAmount: payloadNumber(event.payload, ["refundAmount", "refund_amount", "refunds"]) ?? settlement.refundAmount,
    adjustmentAmount: payloadNumber(event.payload, ["adjustmentAmount", "adjustment_amount", "adjustment", "adjustments"]) ?? settlement.adjustmentAmount,
    netAmount: payloadNumber(event.payload, ["netAmount", "net_amount", "net"]) ?? settlement.netAmount,
    direction: payloadDirection(event.payload, settlement.direction),
    openedAt: status === "accruing" ? event.occurredAt : settlement.openedAt,
    closedAt: status === "closed" ? event.occurredAt : settlement.closedAt,
    updatedAt: event.occurredAt,
  };
  await uow.settlements.save(updated);
}

async function applyPayoutEvent(
  uow: PaymentsUnitOfWork,
  event: CanonicalDomainEvent,
): Promise<void> {
  const status = mapPayoutStatus(event.eventType);
  if (!status) {
    return;
  }

  const payout = await uow.payouts.getByProcessorRef(
    event.environment,
    event.sourceProvider,
    eventObjectType(event, "payout"),
    event.aggregateId,
  );
  if (!payout) {
    const merchantAccountId = await resolveFundsMerchantAccountId(uow, event);
    const amount = payloadNumber(event.payload, ["amount"]);
    const currency = payloadCurrency(event.payload);
    if (merchantAccountId === null || amount === null || currency === null) {
      return;
    }

    const providerSettlementId = payloadString(event.payload, ["settlement", "processorSettlementId", "processor_settlement_id"]);
    const settlementId =
      payloadString(event.payload, ["settlementId", "settlement_id"]) ??
      (providerSettlementId !== null ? settlementIdForProviderObject(event, providerSettlementId) : undefined);
    const created: Payout = {
      id: payoutIdForProviderObject(event, event.aggregateId),
      environment: event.environment,
      merchantAccountId,
      payoutAccountId: payloadString(event.payload, [
        "payoutAccountId",
        "payout_account_id",
        "destination",
        "destination_id",
      ]) ?? undefined,
      settlementId,
      amount,
      currency,
      direction: payloadDirection(event.payload, "debit"),
      status,
      expectedArrivalAt: payloadString(event.payload, ["expectedArrivalAt", "expected_arrival_at"]) ?? undefined,
      failureCode: payloadString(event.payload, ["failureCode", "failure_code"]) ?? undefined,
      failureMessage: payloadString(event.payload, ["failureMessage", "failure_message"]) ?? undefined,
      processorRefs: [{
        provider: event.sourceProvider,
        objectType: eventObjectType(event, "payout"),
        objectId: event.aggregateId,
        relationship: "payout",
        recordedAt: event.occurredAt,
      }],
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
    };
    await uow.payouts.save(created);
    return;
  }

  if (isTerminalPayoutStatus(payout.status) && payout.status !== status) {
    return;
  }

  const updated: Payout = {
    ...payout,
    status,
    amount: payloadNumber(event.payload, ["amount"]) ?? payout.amount,
    currency: payloadCurrency(event.payload) ?? payout.currency,
    direction: payloadDirection(event.payload, payout.direction),
    expectedArrivalAt: payloadString(event.payload, ["expectedArrivalAt", "expected_arrival_at"]) ?? payout.expectedArrivalAt,
    failureCode: payloadString(event.payload, ["failureCode", "failure_code"]) ?? payout.failureCode,
    failureMessage: payloadString(event.payload, ["failureMessage", "failure_message"]) ?? payout.failureMessage,
    updatedAt: event.occurredAt,
  };
  await uow.payouts.save(updated);
}

async function applyDisputeEvent(
  uow: PaymentsUnitOfWork,
  event: CanonicalDomainEvent,
): Promise<void> {
  const state = mapDisputeState(event.eventType);
  if (!state) {
    return;
  }

  const dispute = await uow.disputes.getByProcessorRef(
    event.environment,
    event.sourceProvider,
    event.payload.objectType && typeof event.payload.objectType === "string" ? event.payload.objectType : "dispute",
    event.aggregateId,
  );
  if (!dispute) {
    return;
  }

  const updated: Dispute = {
    ...dispute,
    stage: state.stage,
    responseState: state.responseState,
    closedAt: state.responseState === "closed" ? event.occurredAt : dispute.closedAt,
    updatedAt: event.occurredAt,
  };
  await uow.disputes.save(updated);
}

export function createCanonicalEventsService(
  dependencies: CanonicalEventsServiceDependencies,
): CanonicalEventsService {
  return {
    async applyCanonicalEvents(events: readonly CanonicalDomainEvent[]): Promise<void> {
      await dependencies.uow.runInTransaction(async (uow) => {
        for (const event of events) {
          if (event.aggregateType === "merchant_account") {
            await applyMerchantEvent(uow, event);
            continue;
          }
          if (event.aggregateType === "payment") {
            await applyPaymentEvent(uow, event);
            continue;
          }
          if (event.aggregateType === "payment_method") {
            await applyPaymentMethodEvent(uow, event);
            continue;
          }
          if (event.aggregateType === "refund") {
            await applyRefundEvent(uow, event);
            continue;
          }
          if (event.aggregateType === "settlement") {
            await applySettlementEvent(uow, event);
            continue;
          }
          if (event.aggregateType === "payout") {
            await applyPayoutEvent(uow, event);
            continue;
          }
          if (event.aggregateType === "dispute") {
            await applyDisputeEvent(uow, event);
          }
        }
      });
    },
  };
}
