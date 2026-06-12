export interface RequestMoreInfoAction {
  readonly reason: string;
}

export interface ApproveOnboardingAction {
  readonly reason?: string;
}

export interface RejectOnboardingAction {
  readonly reason: string;
}

export interface RestrictCapabilityAction {
  readonly reason: string;
  readonly expiresAt?: string;
}

export interface RestoreCapabilityAction {
  readonly reason: string;
}

export interface ApproveSettlementAction {
  readonly reason?: string;
}

export interface HoldSettlementAction {
  readonly reason: string;
}

export interface ApproveRefundAction {
  readonly reason?: string;
}

export interface DenyRefundAction {
  readonly reason: string;
}
