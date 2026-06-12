import type {
  CardPresentPaymentIntentId,
  CurrencyCode,
  CustomerProfileId,
  Environment,
  MerchantAccountId,
  Metadata,
  PaymentId,
  TerminalConnectionSessionId,
  TerminalLocationId,
  TerminalReaderId,
} from "../../domain/common";
import type {
  CardPresentCapturePolicy,
  CardPresentIntentStatus,
  TerminalAddress,
  TerminalConnectionSessionStatus,
  TerminalLocationStatus,
  TerminalReaderConnectivityStatus,
  TerminalReaderHealthStatus,
  TerminalReaderRegistrationStatus,
} from "../../domain/terminal";

export type TerminalNextAction =
  | "none"
  | "resolve_merchant_readiness"
  | "enable_location"
  | "register_reader"
  | "bring_reader_online"
  | "repair_reader";

export interface CreateTerminalLocationCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly displayName: string;
  readonly address?: TerminalAddress;
  readonly metadata?: Metadata;
  readonly idempotencyKey?: string;
}

export interface TerminalLocationSnapshot {
  readonly id: TerminalLocationId;
  readonly merchantAccountId: MerchantAccountId;
  readonly displayName: string;
  readonly status: TerminalLocationStatus;
  readonly address?: TerminalAddress;
  readonly metadata?: Metadata;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListTerminalLocationsQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly status?: TerminalLocationStatus;
}

export interface RegisterTerminalReaderCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly locationId: TerminalLocationId;
  readonly label: string;
  readonly registrationStatus?: TerminalReaderRegistrationStatus;
  readonly healthStatus?: TerminalReaderHealthStatus;
  readonly connectivityStatus?: TerminalReaderConnectivityStatus;
  readonly deviceType?: string;
  readonly serialNumberMasked?: string;
  readonly metadata?: Metadata;
  readonly idempotencyKey?: string;
}

export interface TerminalReaderSnapshot {
  readonly id: TerminalReaderId;
  readonly merchantAccountId: MerchantAccountId;
  readonly locationId: TerminalLocationId;
  readonly label: string;
  readonly registrationStatus: TerminalReaderRegistrationStatus;
  readonly healthStatus: TerminalReaderHealthStatus;
  readonly connectivityStatus: TerminalReaderConnectivityStatus;
  readonly deviceType?: string;
  readonly serialNumberMasked?: string;
  readonly metadata?: Metadata;
  readonly nextAction: TerminalNextAction;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListTerminalReadersQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly locationId?: TerminalLocationId;
}

export interface CreateTerminalConnectionSessionCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly locationId: TerminalLocationId;
  readonly readerId?: TerminalReaderId;
  readonly createdByType: "operator" | "pos_client" | "system";
  readonly createdByRef: string;
  readonly idempotencyKey?: string;
}

export interface TerminalConnectionSessionSnapshot {
  readonly id: TerminalConnectionSessionId;
  readonly merchantAccountId: MerchantAccountId;
  readonly locationId: TerminalLocationId;
  readonly readerId?: TerminalReaderId;
  readonly status: TerminalConnectionSessionStatus;
  readonly clientToken: string;
  readonly expiresAt: string;
  readonly nextAction: TerminalNextAction;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCardPresentPaymentIntentCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly locationId: TerminalLocationId;
  readonly readerId: TerminalReaderId;
  readonly connectionSessionId?: TerminalConnectionSessionId;
  readonly customerProfileId?: CustomerProfileId;
  readonly externalOrderRef?: string;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly capturePolicy: CardPresentCapturePolicy;
  readonly metadata?: Metadata;
  readonly idempotencyKey?: string;
}

export interface CardPresentPaymentIntentSnapshot {
  readonly id: CardPresentPaymentIntentId;
  readonly paymentId?: PaymentId;
  readonly merchantAccountId: MerchantAccountId;
  readonly locationId: TerminalLocationId;
  readonly readerId: TerminalReaderId;
  readonly connectionSessionId?: TerminalConnectionSessionId;
  readonly customerProfileId?: CustomerProfileId;
  readonly externalOrderRef?: string;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly status: CardPresentIntentStatus;
  readonly capturePolicy: CardPresentCapturePolicy;
  readonly nextAction: TerminalNextAction | "capture" | "cancel";
  readonly canCapture: boolean;
  readonly canCancel: boolean;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly metadata?: Metadata;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly authorizedAt?: string;
  readonly capturedAt?: string;
  readonly canceledAt?: string;
}

export interface GetCardPresentPaymentIntentQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly cardPresentPaymentIntentId: CardPresentPaymentIntentId;
}

export interface ListCardPresentPaymentIntentsQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly status?: CardPresentIntentStatus;
}

export interface CaptureCardPresentPaymentIntentCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly cardPresentPaymentIntentId: CardPresentPaymentIntentId;
  readonly amount?: number;
  readonly tipAmount?: number;
  readonly idempotencyKey?: string;
}

export interface CancelCardPresentPaymentIntentCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly cardPresentPaymentIntentId: CardPresentPaymentIntentId;
}
