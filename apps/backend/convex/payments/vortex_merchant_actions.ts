"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";
import { isAdmin } from "../auth.utils";
import {
  readVortexBillingEnvFromProcess,
  requestVortexBillingJson,
} from "../vortex_billing/payable_actions";

type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
type JsonObject = { readonly [key: string]: Json };
type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

type VortexMerchantState = {
  readonly chargesEnabled: boolean;
  readonly payoutsEnabled: boolean;
  readonly detailsSubmitted: boolean;
  readonly requirements: {
    readonly currentlyDue: string[];
    readonly eventuallyDue: string[];
    readonly pastDue: string[];
    readonly disabledReason?: string;
  };
  readonly capabilities: {
    readonly cardPayments: string;
    readonly transfers: string;
    readonly usBankAccountAchPayments?: string;
  };
};

type CreateVortexMerchantAccountResult = {
  readonly merchantAccountId: string;
  readonly state: VortexMerchantState;
};

type CreateVortexOnboardingLinkResult = {
  readonly url: string;
  readonly onboardingSessionId: string;
  readonly expiresAt: string;
};

type FeeHandling = "absorb" | "pass_to_recipient";
type SettlementStatus = "accruing" | "closed" | "approved" | "paid_out" | "failed" | "reversed";
type PayoutStatus =
  | "pending"
  | "submitted"
  | "in_transit"
  | "succeeded"
  | "failed"
  | "returned"
  | "held";
type MoneyDirection = "credit" | "debit";

type SettlementSnapshot = {
  readonly id: string;
  readonly environment: string;
  readonly merchantAccountId: string;
  readonly currency: string;
  readonly status: SettlementStatus;
  readonly grossAmount: number;
  readonly feeAmount: number;
  readonly refundAmount: number;
  readonly adjustmentAmount: number;
  readonly netAmount: number;
  readonly direction: MoneyDirection;
  readonly accrualStartAt?: string;
  readonly accrualEndAt?: string;
  readonly autoCloseAt?: string;
  readonly openedAt?: string;
  readonly closedAt?: string;
  readonly approvedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type PayoutSnapshot = {
  readonly id: string;
  readonly environment: string;
  readonly merchantAccountId: string;
  readonly payoutAccountId?: string;
  readonly settlementId?: string;
  readonly status: PayoutStatus;
  readonly amount: number;
  readonly currency: string;
  readonly direction: MoneyDirection;
  readonly expectedArrivalAt?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type SellerPayoutCapability = {
  readonly key: string;
  readonly status: "enabled" | "disabled" | "unknown";
  readonly reason: string;
  readonly source: "payout_profile" | "agreement_guardrail" | "operator_policy";
};

type MerchantSellerPayoutProfileSnapshot = {
  readonly environment: string;
  readonly merchantAccountId: string;
  readonly mode: string;
  readonly payoutRail: string;
  readonly payoutSchedule: string;
  readonly currency?: string;
  readonly settlementDelayDays?: number;
  readonly submissionDelayDays?: number;
  readonly fundingRequirement?: string;
  readonly sameDayAchEligible?: boolean;
  readonly instantPayoutEligible?: boolean;
  readonly grossPayoutEnabled?: boolean;
  readonly capabilities: SellerPayoutCapability[];
  readonly fetchedAt: string;
};

type DerivedCurrencyBalance = {
  readonly currency: string;
  readonly derived: true;
  readonly label: "derived_from_vortex_settlements_and_payouts";
  readonly settledNet: number;
  readonly pendingSettlement: number;
  readonly paidOut: number;
  readonly payoutInFlight: number;
  readonly availableForPayout: number;
};

type DerivedBalance = {
  readonly derived: true;
  readonly label: "derived_from_vortex_settlements_and_payouts";
  readonly currencies: DerivedCurrencyBalance[];
};

type MutableDerivedCurrencyBalance = {
  derived: true;
  label: "derived_from_vortex_settlements_and_payouts";
  settledNet: number;
  pendingSettlement: number;
  paidOut: number;
  payoutInFlight: number;
  availableForPayout: number;
};

type VortexMerchantPayoutDataResult = {
  readonly settlements: SettlementSnapshot[];
  readonly payouts: PayoutSnapshot[];
  readonly payoutProfile: MerchantSellerPayoutProfileSnapshot | null;
  readonly derivedBalance: DerivedBalance;
};

const settlementStatusValidator = v.union(
  v.literal("accruing"),
  v.literal("closed"),
  v.literal("approved"),
  v.literal("paid_out"),
  v.literal("failed"),
  v.literal("reversed"),
);
const payoutStatusValidator = v.union(
  v.literal("pending"),
  v.literal("submitted"),
  v.literal("in_transit"),
  v.literal("succeeded"),
  v.literal("failed"),
  v.literal("returned"),
  v.literal("held"),
);
const moneyDirectionValidator = v.union(v.literal("credit"), v.literal("debit"));

const settlementSnapshotValidator = v.object({
  id: v.string(),
  environment: v.string(),
  merchantAccountId: v.string(),
  currency: v.string(),
  status: settlementStatusValidator,
  grossAmount: v.number(),
  feeAmount: v.number(),
  refundAmount: v.number(),
  adjustmentAmount: v.number(),
  netAmount: v.number(),
  direction: moneyDirectionValidator,
  accrualStartAt: v.optional(v.string()),
  accrualEndAt: v.optional(v.string()),
  autoCloseAt: v.optional(v.string()),
  openedAt: v.optional(v.string()),
  closedAt: v.optional(v.string()),
  approvedAt: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

const payoutSnapshotValidator = v.object({
  id: v.string(),
  environment: v.string(),
  merchantAccountId: v.string(),
  payoutAccountId: v.optional(v.string()),
  settlementId: v.optional(v.string()),
  status: payoutStatusValidator,
  amount: v.number(),
  currency: v.string(),
  direction: moneyDirectionValidator,
  expectedArrivalAt: v.optional(v.string()),
  failureCode: v.optional(v.string()),
  failureMessage: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

const sellerPayoutCapabilityValidator = v.object({
  key: v.string(),
  status: v.union(v.literal("enabled"), v.literal("disabled"), v.literal("unknown")),
  reason: v.string(),
  source: v.union(
    v.literal("payout_profile"),
    v.literal("agreement_guardrail"),
    v.literal("operator_policy"),
  ),
});

const payoutProfileValidator = v.object({
  environment: v.string(),
  merchantAccountId: v.string(),
  mode: v.string(),
  payoutRail: v.string(),
  payoutSchedule: v.string(),
  currency: v.optional(v.string()),
  settlementDelayDays: v.optional(v.number()),
  submissionDelayDays: v.optional(v.number()),
  fundingRequirement: v.optional(v.string()),
  sameDayAchEligible: v.optional(v.boolean()),
  instantPayoutEligible: v.optional(v.boolean()),
  grossPayoutEnabled: v.optional(v.boolean()),
  capabilities: v.array(sellerPayoutCapabilityValidator),
  fetchedAt: v.string(),
});

const derivedCurrencyBalanceValidator = v.object({
  currency: v.string(),
  derived: v.literal(true),
  label: v.literal("derived_from_vortex_settlements_and_payouts"),
  settledNet: v.number(),
  pendingSettlement: v.number(),
  paidOut: v.number(),
  payoutInFlight: v.number(),
  availableForPayout: v.number(),
});

const derivedBalanceValidator = v.object({
  derived: v.literal(true),
  label: v.literal("derived_from_vortex_settlements_and_payouts"),
  currencies: v.array(derivedCurrencyBalanceValidator),
});

const vortexMerchantPayoutDataResultValidator = v.object({
  settlements: v.array(settlementSnapshotValidator),
  payouts: v.array(payoutSnapshotValidator),
  payoutProfile: v.union(payoutProfileValidator, v.null()),
  derivedBalance: derivedBalanceValidator,
});

const EMPTY_DERIVED_BALANCE: DerivedBalance = {
  derived: true,
  label: "derived_from_vortex_settlements_and_payouts",
  currencies: [],
};

const EMPTY_VORTEX_MERCHANT_PAYOUT_DATA: VortexMerchantPayoutDataResult = {
  settlements: [],
  payouts: [],
  payoutProfile: null,
  derivedBalance: EMPTY_DERIVED_BALANCE,
};

async function resolveAdminMembership(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.runQuery(internal.organizations.helpers.getUserByAuthSubject, {
    authSubject: identity.subject,
  });

  if (!user) {
    throw new ConvexError("User not found");
  }

  const membership = await ctx.runQuery(
    internal.organizations.helpers.getActiveMembershipByUserAndOrganization,
    {
      userId: user._id,
      organizationId,
    },
  );

  if (!membership) {
    throw new ConvexError("Organization membership required");
  }

  if (!isAdmin(membership)) {
    throw new ConvexError("Only workspace owners and admins can manage Vortex merchant settings");
  }
}

async function resolveOrganizationMembership(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.runQuery(internal.organizations.helpers.getUserByAuthSubject, {
    authSubject: identity.subject,
  });

  if (!user) {
    throw new ConvexError("User not found");
  }

  const membership = await ctx.runQuery(
    internal.organizations.helpers.getActiveMembershipByUserAndOrganization,
    {
      userId: user._id,
      organizationId,
    },
  );

  if (!membership) {
    throw new ConvexError("Organization membership required");
  }
}

function readObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConvexError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConvexError(`${label} must be a non-empty string`);
  }
  return value;
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConvexError(`${label} must be a finite number`);
  }
  return value;
}

function readOptionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return readNumber(value, label);
}

function readOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new ConvexError(`${label} must be a boolean when present`);
  }
  return value;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string" || value.length === 0) {
    throw new ConvexError(`${label} must be a non-empty string when present`);
  }
  return value;
}

function readDirection(value: unknown, label: string): MoneyDirection {
  if (value === "credit" || value === "debit") {
    return value;
  }
  throw new ConvexError(`${label} must be credit or debit`);
}

function readSettlementStatus(value: unknown, label: string): SettlementStatus {
  if (
    value === "accruing" ||
    value === "closed" ||
    value === "approved" ||
    value === "paid_out" ||
    value === "failed" ||
    value === "reversed"
  ) {
    return value;
  }
  throw new ConvexError(`${label} is not a supported settlement status`);
}

function readPayoutStatus(value: unknown, label: string): PayoutStatus {
  if (
    value === "pending" ||
    value === "submitted" ||
    value === "in_transit" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "returned" ||
    value === "held"
  ) {
    return value;
  }
  throw new ConvexError(`${label} is not a supported payout status`);
}

function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new ConvexError(`${label} must be a boolean`);
  }
  return value;
}

function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new ConvexError(`${label} must be a string array`);
  }
  return value.map((entry) => readString(entry, label));
}

function readListItems<T>(
  body: unknown,
  label: string,
  mapItem: (item: Record<string, unknown>, index: number) => T,
): T[] {
  const root = readObject(body, `${label} response`);
  const data = readObject(root.data, `${label} response data`);
  if (!Array.isArray(data.items)) {
    throw new ConvexError(`${label} response data.items must be an array`);
  }
  return data.items.map((item, index) => mapItem(readObject(item, `${label} item`), index));
}

function readSellerPayoutCapabilities(value: unknown, label: string): SellerPayoutCapability[] {
  if (!Array.isArray(value)) {
    throw new ConvexError(`${label} must be an array`);
  }
  return value.map((entry, index) => {
    const capability = readObject(entry, `${label}[${index}]`);
    const status = readString(capability.status, `${label}[${index}].status`);
    if (status !== "enabled" && status !== "disabled" && status !== "unknown") {
      throw new ConvexError(`${label}[${index}].status is invalid`);
    }
    const source = readString(capability.source, `${label}[${index}].source`);
    if (
      source !== "payout_profile" &&
      source !== "agreement_guardrail" &&
      source !== "operator_policy"
    ) {
      throw new ConvexError(`${label}[${index}].source is invalid`);
    }
    return {
      key: readString(capability.key, `${label}[${index}].key`),
      status,
      reason: readString(capability.reason, `${label}[${index}].reason`),
      source,
    };
  });
}

function readSettlementSnapshot(value: Record<string, unknown>, index: number): SettlementSnapshot {
  const label = `Vortex settlement ${index}`;
  return {
    id: readString(value.id, `${label}.id`),
    environment: readString(value.environment, `${label}.environment`),
    merchantAccountId: readString(value.merchantAccountId, `${label}.merchantAccountId`),
    currency: readString(value.currency, `${label}.currency`),
    status: readSettlementStatus(value.status, `${label}.status`),
    grossAmount: readNumber(value.grossAmount, `${label}.grossAmount`),
    feeAmount: readNumber(value.feeAmount, `${label}.feeAmount`),
    refundAmount: readNumber(value.refundAmount, `${label}.refundAmount`),
    adjustmentAmount: readNumber(value.adjustmentAmount, `${label}.adjustmentAmount`),
    netAmount: readNumber(value.netAmount, `${label}.netAmount`),
    direction: readDirection(value.direction, `${label}.direction`),
    accrualStartAt: readOptionalString(value.accrualStartAt, `${label}.accrualStartAt`),
    accrualEndAt: readOptionalString(value.accrualEndAt, `${label}.accrualEndAt`),
    autoCloseAt: readOptionalString(value.autoCloseAt, `${label}.autoCloseAt`),
    openedAt: readOptionalString(value.openedAt, `${label}.openedAt`),
    closedAt: readOptionalString(value.closedAt, `${label}.closedAt`),
    approvedAt: readOptionalString(value.approvedAt, `${label}.approvedAt`),
    createdAt: readString(value.createdAt, `${label}.createdAt`),
    updatedAt: readString(value.updatedAt, `${label}.updatedAt`),
  };
}

function readPayoutSnapshot(value: Record<string, unknown>, index: number): PayoutSnapshot {
  const label = `Vortex payout ${index}`;
  return {
    id: readString(value.id, `${label}.id`),
    environment: readString(value.environment, `${label}.environment`),
    merchantAccountId: readString(value.merchantAccountId, `${label}.merchantAccountId`),
    payoutAccountId: readOptionalString(value.payoutAccountId, `${label}.payoutAccountId`),
    settlementId: readOptionalString(value.settlementId, `${label}.settlementId`),
    status: readPayoutStatus(value.status, `${label}.status`),
    amount: readNumber(value.amount, `${label}.amount`),
    currency: readString(value.currency, `${label}.currency`),
    direction: readDirection(value.direction, `${label}.direction`),
    expectedArrivalAt: readOptionalString(value.expectedArrivalAt, `${label}.expectedArrivalAt`),
    failureCode: readOptionalString(value.failureCode, `${label}.failureCode`),
    failureMessage: readOptionalString(value.failureMessage, `${label}.failureMessage`),
    createdAt: readString(value.createdAt, `${label}.createdAt`),
    updatedAt: readString(value.updatedAt, `${label}.updatedAt`),
  };
}

function readPayoutProfile(body: unknown): MerchantSellerPayoutProfileSnapshot | null {
  const root = readObject(body, "Vortex payout profile response");
  if (root.data === null) {
    return null;
  }
  const data = readObject(root.data, "Vortex payout profile response data");
  return {
    environment: readString(data.environment, "Vortex payout profile environment"),
    merchantAccountId: readString(data.merchantAccountId, "Vortex payout profile merchant id"),
    mode: readString(data.mode, "Vortex payout profile mode"),
    payoutRail: readString(data.payoutRail, "Vortex payout profile rail"),
    payoutSchedule: readString(data.payoutSchedule, "Vortex payout profile schedule"),
    currency: readOptionalString(data.currency, "Vortex payout profile currency"),
    settlementDelayDays: readOptionalNumber(
      data.settlementDelayDays,
      "Vortex payout profile settlement delay days",
    ),
    submissionDelayDays: readOptionalNumber(
      data.submissionDelayDays,
      "Vortex payout profile submission delay days",
    ),
    fundingRequirement: readOptionalString(
      data.fundingRequirement,
      "Vortex payout profile funding requirement",
    ),
    sameDayAchEligible: readOptionalBoolean(
      data.sameDayAchEligible,
      "Vortex payout profile same day ACH eligibility",
    ),
    instantPayoutEligible: readOptionalBoolean(
      data.instantPayoutEligible,
      "Vortex payout profile instant payout eligibility",
    ),
    grossPayoutEnabled: readOptionalBoolean(
      data.grossPayoutEnabled,
      "Vortex payout profile gross payout flag",
    ),
    capabilities: readSellerPayoutCapabilities(
      data.capabilities,
      "Vortex payout profile capabilities",
    ),
    fetchedAt: readString(data.fetchedAt, "Vortex payout profile fetched at"),
  };
}

function signedAmount(direction: MoneyDirection, amount: number): number {
  return direction === "debit" ? -amount : amount;
}

function getOrCreateDerivedCurrency(
  balances: Map<string, MutableDerivedCurrencyBalance>,
  currency: string,
): MutableDerivedCurrencyBalance {
  const existing = balances.get(currency);
  if (existing !== undefined) {
    return existing;
  }
  const created: MutableDerivedCurrencyBalance = {
    derived: true,
    label: "derived_from_vortex_settlements_and_payouts",
    settledNet: 0,
    pendingSettlement: 0,
    paidOut: 0,
    payoutInFlight: 0,
    availableForPayout: 0,
  };
  balances.set(currency, created);
  return created;
}

function deriveBalance(input: {
  readonly settlements: readonly SettlementSnapshot[];
  readonly payouts: readonly PayoutSnapshot[];
}): DerivedBalance {
  const balances = new Map<string, MutableDerivedCurrencyBalance>();
  const availableSettlementIds = new Set<string>();

  for (const settlement of input.settlements) {
    const balance = getOrCreateDerivedCurrency(balances, settlement.currency);
    const amount = signedAmount(settlement.direction, settlement.netAmount);

    if (
      settlement.status === "closed" ||
      settlement.status === "approved" ||
      settlement.status === "paid_out"
    ) {
      balance.settledNet += amount;
    }
    if (settlement.status === "accruing") {
      balance.pendingSettlement += amount;
    }
    if (settlement.status === "closed" || settlement.status === "approved") {
      balance.availableForPayout += amount;
      availableSettlementIds.add(settlement.id);
    }
  }

  for (const payout of input.payouts) {
    const balance = getOrCreateDerivedCurrency(balances, payout.currency);
    const amount = signedAmount(payout.direction, payout.amount);

    if (payout.status === "succeeded") {
      balance.paidOut += amount;
    }
    if (
      payout.status === "pending" ||
      payout.status === "submitted" ||
      payout.status === "in_transit" ||
      payout.status === "held"
    ) {
      balance.payoutInFlight += amount;
    }
    if (
      payout.settlementId !== undefined &&
      availableSettlementIds.has(payout.settlementId) &&
      payout.status !== "failed" &&
      payout.status !== "returned"
    ) {
      balance.availableForPayout -= Math.abs(amount);
    }
  }

  return {
    derived: true,
    label: "derived_from_vortex_settlements_and_payouts",
    currencies: [...balances.entries()]
      .map(([currency, balance]) => ({ currency, ...balance }))
      .sort((left, right) => left.currency.localeCompare(right.currency)),
  };
}

function readVortexMerchantAccountId(body: unknown): string {
  const root = readObject(body, "Vortex merchant response");
  const data = readObject(root.data, "Vortex merchant response data");
  return (
    readOptionalString(data.merchantAccountId, "Vortex merchant account id") ??
    readString(data.id, "Vortex merchant id")
  );
}

function readVortexOnboardingLink(body: unknown): CreateVortexOnboardingLinkResult {
  const root = readObject(body, "Vortex onboarding link response");
  const data = readObject(root.data, "Vortex onboarding link response data");
  return {
    url: readString(data.url, "Vortex onboarding link url"),
    onboardingSessionId: readString(
      data.onboardingSessionId,
      "Vortex onboarding session id",
    ),
    expiresAt: readString(data.expiresAt, "Vortex onboarding link expiration"),
  };
}

function mapCapabilityStatus(
  activeCapabilityKeys: readonly string[],
  restrictedCapabilityKeys: readonly string[],
  capabilityKey: string,
): string {
  if (activeCapabilityKeys.includes(capabilityKey)) {
    return "active";
  }
  if (restrictedCapabilityKeys.includes(capabilityKey)) {
    return "restricted";
  }
  return "inactive";
}

function mapVortexState(input: {
  readonly stateBody: unknown;
  readonly capabilitiesBody: unknown;
}): VortexMerchantState {
  const stateRoot = readObject(input.stateBody, "Vortex merchant state response");
  const state = readObject(stateRoot.data, "Vortex merchant state response data");
  const capabilitiesRoot = readObject(
    input.capabilitiesBody,
    "Vortex merchant capabilities response",
  );
  const capabilities = readObject(
    capabilitiesRoot.data,
    "Vortex merchant capabilities response data",
  );
  const activeCapabilityKeys = readStringArray(
    state.activeCapabilityKeys,
    "Vortex merchant active capability keys",
  );
  const restrictedCapabilityKeys = readStringArray(
    state.restrictedCapabilityKeys,
    "Vortex merchant restricted capability keys",
  );
  const capabilityActiveKeys = readStringArray(
    capabilities.activeCapabilityKeys,
    "Vortex merchant capabilities active keys",
  );
  const capabilityRestrictedKeys = readStringArray(
    capabilities.restrictedCapabilityKeys,
    "Vortex merchant capabilities restricted keys",
  );
  const mergedActiveCapabilityKeys = [
    ...new Set([...activeCapabilityKeys, ...capabilityActiveKeys]),
  ];
  const mergedRestrictedCapabilityKeys = [
    ...new Set([...restrictedCapabilityKeys, ...capabilityRestrictedKeys]),
  ];
  const payoutReadiness = readString(state.payoutReadiness, "Vortex merchant payout readiness");
  const chargesEnabled = readBoolean(state.canAcceptPayments, "Vortex merchant payment readiness");
  const disabledReason =
    readOptionalString(state.payoutBlockReason, "Vortex merchant payout block reason") ??
    (chargesEnabled ? undefined : readString(state.merchantStatus, "Vortex merchant status"));

  return {
    chargesEnabled,
    payoutsEnabled: payoutReadiness === "ready",
    detailsSubmitted:
      readOptionalString(state.onboardingStatus, "Vortex merchant onboarding status") ===
        "approved" || readString(state.merchantStatus, "Vortex merchant status") === "active",
    requirements: {
      currentlyDue: readStringArray(state.openRequirementIds, "Vortex merchant open requirements"),
      eventuallyDue: [],
      pastDue: [],
      ...(disabledReason !== undefined ? { disabledReason } : {}),
    },
    capabilities: {
      cardPayments: chargesEnabled
        ? "active"
        : mapCapabilityStatus(
            mergedActiveCapabilityKeys,
            mergedRestrictedCapabilityKeys,
            "card_payments",
          ),
      transfers: payoutReadiness,
      usBankAccountAchPayments: mapCapabilityStatus(
        mergedActiveCapabilityKeys,
        mergedRestrictedCapabilityKeys,
        "us_bank_account_ach_payments",
      ),
    },
  };
}

async function readRemoteVortexMerchantState(
  merchantAccountId: string,
  fetcher: Fetcher = (input, init) => fetch(input, init),
): Promise<VortexMerchantState> {
  const env = readVortexBillingEnvFromProcess();
  const environment = encodeURIComponent(env.paymentsEnvironment);
  const [stateBody, capabilitiesBody] = await Promise.all([
    requestVortexBillingJson(
      {
        apiBaseUrl: env.apiBaseUrl,
        apiKey: env.apiKey,
        method: "GET",
        path: `/v1/merchant-accounts/${encodeURIComponent(merchantAccountId)}/state?environment=${environment}`,
        failureLabel: "Vortex merchant state refresh",
      },
      fetcher,
    ),
    requestVortexBillingJson(
      {
        apiBaseUrl: env.apiBaseUrl,
        apiKey: env.apiKey,
        method: "GET",
        path: `/v1/merchant-accounts/${encodeURIComponent(merchantAccountId)}/capabilities?environment=${environment}`,
        failureLabel: "Vortex merchant capabilities refresh",
      },
      fetcher,
    ),
  ]);
  return mapVortexState({ stateBody, capabilitiesBody });
}

async function readRemoteVortexMerchantPayoutData(
  merchantAccountId: string,
  fetcher: Fetcher = (input, init) => fetch(input, init),
): Promise<VortexMerchantPayoutDataResult> {
  const env = readVortexBillingEnvFromProcess();
  const environment = encodeURIComponent(env.paymentsEnvironment);
  const merchantPathSegment = encodeURIComponent(merchantAccountId);
  const [settlementsBody, payoutsBody, payoutProfileBody] = await Promise.all([
    requestVortexBillingJson(
      {
        apiBaseUrl: env.apiBaseUrl,
        apiKey: env.apiKey,
        method: "GET",
        path: `/v1/merchant-accounts/${merchantPathSegment}/settlements?environment=${environment}`,
        failureLabel: "Vortex merchant settlements read",
      },
      fetcher,
    ),
    requestVortexBillingJson(
      {
        apiBaseUrl: env.apiBaseUrl,
        apiKey: env.apiKey,
        method: "GET",
        path: `/v1/merchant-accounts/${merchantPathSegment}/payouts?environment=${environment}`,
        failureLabel: "Vortex merchant payouts read",
      },
      fetcher,
    ),
    requestVortexBillingJson(
      {
        apiBaseUrl: env.apiBaseUrl,
        apiKey: env.apiKey,
        method: "GET",
        path: `/v1/merchant-accounts/${merchantPathSegment}/payout-profile?environment=${environment}`,
        failureLabel: "Vortex merchant payout profile read",
      },
      fetcher,
    ),
  ]);
  const settlements = readListItems(
    settlementsBody,
    "Vortex merchant settlements",
    readSettlementSnapshot,
  );
  const payouts = readListItems(payoutsBody, "Vortex merchant payouts", readPayoutSnapshot);

  return {
    settlements,
    payouts,
    payoutProfile: readPayoutProfile(payoutProfileBody),
    derivedBalance: deriveBalance({ settlements, payouts }),
  };
}

async function persistVortexMerchantAccount(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  merchantAccountId: string,
  state: VortexMerchantState,
  feeHandling: FeeHandling | undefined,
): Promise<void> {
  await ctx.runMutation(internal.payments.merchant_account_mutations.upsertMerchantAccount, {
    organizationId,
    merchantAccountId,
    vortexMerchantAccountId: merchantAccountId,
    accountType: "standard",
    chargesEnabled: state.chargesEnabled,
    payoutsEnabled: state.payoutsEnabled,
    detailsSubmitted: state.detailsSubmitted,
    requirements: state.requirements,
    capabilities: state.capabilities,
    feeHandling,
    defaultCurrency: "USD",
  });
}

async function createVortexMerchantAccountForOrganization(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  feeHandling: FeeHandling | undefined,
): Promise<CreateVortexMerchantAccountResult> {
  const existing = await ctx.runQuery(
    internal.payments.merchant_account_mutations.getAccountByOrganizationId,
    {
      organizationId,
    },
  );
  if (existing?.provider === "vortex" && existing.vortexMerchantAccountId !== undefined) {
    return {
      merchantAccountId: existing.vortexMerchantAccountId,
      state: {
        chargesEnabled: existing.chargesEnabled,
        payoutsEnabled: existing.payoutsEnabled,
        detailsSubmitted: existing.detailsSubmitted,
        requirements: existing.requirements ?? {
          currentlyDue: [],
          eventuallyDue: [],
          pastDue: [],
        },
        capabilities: existing.capabilities ?? {
          cardPayments: "inactive",
          transfers: "unknown",
        },
      },
    };
  }
  if (existing) {
    throw new ConvexError("A non-Vortex merchant account already exists for this organization");
  }

  const organization = await ctx.runQuery(internal.organizations.helpers.getOrganizationById, {
    organizationId,
  });
  if (!organization) {
    throw new ConvexError("Organization not found");
  }

  const env = readVortexBillingEnvFromProcess();
  const body: JsonObject = {
    environment: env.paymentsEnvironment,
    // Do NOT send tenantId: Vortex derives the tenant from the API key's org context and rejects
    // a mismatch ("tenantId must match current organization"). Seal's own org id is not the Vortex
    // tenant. externalMerchantRef + metadata.sealOrganizationId carry the Seal linkage instead.
    externalMerchantRef: organizationId,
    displayName: organization.name,
    // Must be a valid Finix business_type enum (Vortex passes legalEntityType through to Finix,
    // which rejects unknown values like "company"). Default to CORPORATION — the entity type the
    // hosted-KYC underwriting dataset is proven against end-to-end to real-Finix charges-ready.
    // TODO(1b-followup): collect the real entity type + entity-type-specific fields during hosted KYC.
    legalEntityType: "CORPORATION",
    country: "USA",
    merchantMode: "processing",
    defaultCurrency: "USD",
    metadata: {
      sourceSystem: env.sourceNamespace,
      sealOrganizationId: organizationId,
    },
  };
  const responseBody = await requestVortexBillingJson(
    {
      apiBaseUrl: env.apiBaseUrl,
      apiKey: env.apiKey,
      path: "/v1/merchant-accounts",
      idempotencyKey: `seal-vortex-merchant:${organizationId}`,
      body,
      failureLabel: "Vortex merchant create",
    },
    (input, init) => fetch(input, init),
  );
  const merchantAccountId = readVortexMerchantAccountId(responseBody);
  const state: VortexMerchantState = {
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    requirements: {
      currentlyDue: [],
      eventuallyDue: [],
      pastDue: [],
      disabledReason: "draft",
    },
    capabilities: {
      cardPayments: "inactive",
      transfers: "unknown",
      usBankAccountAchPayments: "inactive",
    },
  };
  await persistVortexMerchantAccount(ctx, organizationId, merchantAccountId, state, feeHandling);

  return {
    merchantAccountId,
    state,
  };
}

async function refreshVortexMerchantAccountForOrganization(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
): Promise<{ readonly status: "not_connected" | "refreshed" }> {
  const existing = await ctx.runQuery(
    internal.payments.merchant_account_mutations.getAccountByOrganizationId,
    {
      organizationId,
    },
  );
  if (existing?.provider !== "vortex" || existing.vortexMerchantAccountId === undefined) {
    return { status: "not_connected" };
  }

  const state = await readRemoteVortexMerchantState(existing.vortexMerchantAccountId);
  await persistVortexMerchantAccount(
    ctx,
    organizationId,
    existing.vortexMerchantAccountId,
    state,
    undefined,
  );
  return { status: "refreshed" };
}

async function createVortexOnboardingLinkForOrganization(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
): Promise<CreateVortexOnboardingLinkResult> {
  const existing = await ctx.runQuery(
    internal.payments.merchant_account_mutations.getAccountByOrganizationId,
    {
      organizationId,
    },
  );
  if (existing?.provider !== "vortex" || existing.vortexMerchantAccountId === undefined) {
    throw new ConvexError("Create a Vortex Connect account before starting verification");
  }

  const env = readVortexBillingEnvFromProcess();
  const body: JsonObject = {
    environment: env.paymentsEnvironment,
    createdByRef: `seal:${organizationId}`,
  };
  const responseBody = await requestVortexBillingJson(
    {
      apiBaseUrl: env.apiBaseUrl,
      apiKey: env.apiKey,
      path: `/v1/merchant-accounts/${encodeURIComponent(
        existing.vortexMerchantAccountId,
      )}/onboarding-link`,
      body,
      failureLabel: "Vortex merchant onboarding link create",
    },
    (input, init) => fetch(input, init),
  );

  return readVortexOnboardingLink(responseBody);
}

export const createVortexMerchantAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
    feeHandling: v.optional(v.union(v.literal("absorb"), v.literal("pass_to_recipient"))),
  },
  returns: v.object({
    merchantAccountId: v.string(),
    state: v.object({
      chargesEnabled: v.boolean(),
      payoutsEnabled: v.boolean(),
      detailsSubmitted: v.boolean(),
      requirements: v.object({
        currentlyDue: v.array(v.string()),
        eventuallyDue: v.array(v.string()),
        pastDue: v.array(v.string()),
        disabledReason: v.optional(v.string()),
      }),
      capabilities: v.object({
        cardPayments: v.string(),
        transfers: v.string(),
        usBankAccountAchPayments: v.optional(v.string()),
      }),
    }),
  }),
  handler: async (ctx, args): Promise<CreateVortexMerchantAccountResult> => {
    await resolveAdminMembership(ctx, args.organizationId);
    return await createVortexMerchantAccountForOrganization(
      ctx,
      args.organizationId,
      args.feeHandling,
    );
  },
});

export const createVortexOnboardingLink = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    url: v.string(),
    onboardingSessionId: v.string(),
    expiresAt: v.string(),
  }),
  handler: async (ctx, args): Promise<CreateVortexOnboardingLinkResult> => {
    await resolveAdminMembership(ctx, args.organizationId);
    return await createVortexOnboardingLinkForOrganization(ctx, args.organizationId);
  },
});

export const createVortexMerchantProofAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    merchantAccountId: v.string(),
    state: v.object({
      chargesEnabled: v.boolean(),
      payoutsEnabled: v.boolean(),
      detailsSubmitted: v.boolean(),
      requirements: v.object({
        currentlyDue: v.array(v.string()),
        eventuallyDue: v.array(v.string()),
        pastDue: v.array(v.string()),
        disabledReason: v.optional(v.string()),
      }),
      capabilities: v.object({
        cardPayments: v.string(),
        transfers: v.string(),
        usBankAccountAchPayments: v.optional(v.string()),
      }),
    }),
  }),
  handler: async (ctx, args): Promise<CreateVortexMerchantAccountResult> => {
    return await createVortexMerchantAccountForOrganization(ctx, args.organizationId, undefined);
  },
});

export const refreshVortexMerchantAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    status: v.union(v.literal("not_connected"), v.literal("refreshed")),
  }),
  handler: async (ctx, args): Promise<{ readonly status: "not_connected" | "refreshed" }> => {
    await resolveAdminMembership(ctx, args.organizationId);
    return await refreshVortexMerchantAccountForOrganization(ctx, args.organizationId);
  },
});

export const refreshVortexMerchantProofAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.object({
    status: v.union(v.literal("not_connected"), v.literal("refreshed")),
  }),
  handler: async (ctx, args): Promise<{ readonly status: "not_connected" | "refreshed" }> => {
    return await refreshVortexMerchantAccountForOrganization(ctx, args.organizationId);
  },
});

export const getVortexMerchantPayoutData = action({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: vortexMerchantPayoutDataResultValidator,
  handler: async (ctx, args): Promise<VortexMerchantPayoutDataResult> => {
    await resolveOrganizationMembership(ctx, args.organizationId);

    const existing = await ctx.runQuery(
      internal.payments.merchant_account_mutations.getAccountByOrganizationId,
      {
        organizationId: args.organizationId,
      },
    );

    if (existing?.provider !== "vortex" || existing.vortexMerchantAccountId === undefined) {
      return EMPTY_VORTEX_MERCHANT_PAYOUT_DATA;
    }

    return await readRemoteVortexMerchantPayoutData(existing.vortexMerchantAccountId);
  },
});
