import type {
  CurrencyCode,
  DisputeId,
  Environment,
  IsoTimestamp,
  MerchantAccountId,
  PaymentId,
  ProcessorRef,
  TerminalSessionId,
} from "./common";

export type DisputeStage =
  | "inquiry"
  | "chargeback"
  | "review"
  | "won"
  | "lost";

export type DisputeResponseState =
  | "needs_response"
  | "responded"
  | "accepted"
  | "closed";

export interface Dispute {
  readonly id: DisputeId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly paymentId: PaymentId;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly network?: string;
  readonly reasonCode?: string;
  readonly stage: DisputeStage;
  readonly responseState: DisputeResponseState;
  readonly deadlineAt?: IsoTimestamp;
  readonly evidenceStatus?: string;
  readonly openedAt: IsoTimestamp;
  readonly closedAt?: IsoTimestamp;
  readonly processorRefs: readonly ProcessorRef[];
  readonly terminalSessionId?: TerminalSessionId;
  readonly terminalReaderId?: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface TerminalSession {
  readonly id: TerminalSessionId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly locationId?: string;
  readonly readerId?: string;
  readonly paymentIntentId?: string;
  readonly status: string;
  readonly processorRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
