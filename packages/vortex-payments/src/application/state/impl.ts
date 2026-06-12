import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type { MerchantCapability } from "../../domain/merchant";
import type { MerchantAccountState } from "../../domain/state";
import type {
  GetCustomerPaymentStateQuery,
  GetMerchantAccountCapabilitiesQuery,
  GetMerchantAccountStateQuery,
  MerchantAccountStateSnapshot,
  MerchantCapabilitySnapshot,
} from "./contracts";
import type { PaymentsStateReader } from "./service";

export interface StateReaderDependencies {
  readonly uow: PaymentsUnitOfWork;
}

function toCapabilitySnapshot(capability: MerchantCapability): MerchantCapabilitySnapshot {
  return {
    id: capability.id,
    environment: capability.environment,
    merchantAccountId: capability.merchantAccountId,
    capabilityKey: capability.capabilityKey,
    status: capability.status,
    restrictedReason: capability.restrictedReason,
    effectiveAt: capability.effectiveAt,
    expiresAt: capability.expiresAt,
    updatedByType: capability.updatedByType,
    updatedByRef: capability.updatedByRef,
  };
}

function toMerchantAccountStateSnapshot(state: MerchantAccountState): MerchantAccountStateSnapshot {
  return {
    merchantAccountId: state.merchantAccountId,
    environment: state.environment,
    merchantStatus: state.merchantStatus,
    onboardingSessionId: state.onboardingSessionId,
    onboardingStatus: state.onboardingStatus,
    openRequirementIds: state.openRequirementIds,
    activeCapabilityKeys: state.activeCapabilityKeys,
    restrictedCapabilityKeys: state.restrictedCapabilityKeys,
    canAcceptPayments: state.canAcceptPayments,
    payoutReadiness: state.payoutReadiness,
    payoutBlockReason: state.payoutBlockReason,
    defaultPayoutAccountId: state.defaultPayoutAccountId,
    defaultPaymentMethodId: state.defaultPaymentMethodId,
    latestSettlementStatus: state.latestSettlementStatus,
    latestPayoutStatus: state.latestPayoutStatus,
    capabilitySnapshots: state.capabilitySnapshots.map(toCapabilitySnapshot),
    generatedAt: state.generatedAt,
  };
}

export function createStateReader(
  dependencies: StateReaderDependencies,
): PaymentsStateReader {
	  return {
	    async getMerchantAccountState(query: GetMerchantAccountStateQuery) {
	      const state = await dependencies.uow.merchantStates.getByMerchantAccountId(query.merchantAccountId, {
	        environment: query.environment,
	      });
	      return state ? toMerchantAccountStateSnapshot(state) : null;
	    },

    async getMerchantAccountCapabilities(query: GetMerchantAccountCapabilitiesQuery) {
      const state = await dependencies.uow.merchantStates.getByMerchantAccountId(query.merchantAccountId, {
        environment: query.environment,
      });
      if (!state) {
        return null;
      }
      return {
        merchantAccountId: state.merchantAccountId,
        environment: state.environment,
        activeCapabilityKeys: state.activeCapabilityKeys,
        restrictedCapabilityKeys: state.restrictedCapabilityKeys,
	        capabilities: state.capabilitySnapshots.map(toCapabilitySnapshot),
        generatedAt: state.generatedAt,
      };
    },

    async getCustomerPaymentState(query: GetCustomerPaymentStateQuery) {
      return dependencies.uow.customerStates.getByMerchantAndCustomer(
        query.environment,
        query.merchantAccountId,
        query.customerProfileId,
      );
    },
  };
}
