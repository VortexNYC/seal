import type { MerchantAccount, MerchantCapability, MerchantRequirement } from "../domain/merchant";
import type { Refund } from "../domain/payments";
import type { Settlement, Payout } from "../domain/funds";
import type { Dispute } from "../domain/disputes";
import type { CasePriority, CaseSla, CaseType, OperatorCase } from "./cases";

export interface CasePolicyInput {
  readonly caseType: CaseType;
  readonly merchantAccount?: MerchantAccount;
  readonly merchantRequirements?: readonly MerchantRequirement[];
  readonly merchantCapabilities?: readonly MerchantCapability[];
  readonly refund?: Refund;
  readonly settlement?: Settlement;
  readonly payout?: Payout;
  readonly dispute?: Dispute;
  readonly triggerReasonCode?: string;
}

export interface CasePolicyDecision {
  readonly shouldOpenCase: boolean;
  readonly queueKey: string;
  readonly priority: CasePriority;
  readonly reasonCodes: readonly string[];
  readonly sla: CaseSla;
  readonly summary: string;
  readonly description?: string;
}

export interface CasePolicyEngine {
  evaluate(input: CasePolicyInput): CasePolicyDecision;
}

export interface CaseTransitionContext {
  readonly existingCase: OperatorCase;
  readonly action: string;
  readonly actorType: "system" | "operator" | "merchant";
  readonly actorId?: string;
  readonly reasonCode?: string;
}

export interface CaseTransitionDecision {
  readonly allowed: boolean;
  readonly nextStatus?: OperatorCase["status"];
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

export interface CaseTransitionPolicy {
  evaluate(context: CaseTransitionContext): CaseTransitionDecision;
}
