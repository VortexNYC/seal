import type {
  CardPresentPaymentIntentId,
  CurrencyCode,
  CustomerProfileId,
  Environment,
  IsoTimestamp,
  MerchantAccountId,
  Metadata,
  PaymentId,
  ProcessorRef,
  TerminalConnectionSessionId,
  TerminalLocationId,
  TerminalReaderId,
} from "./common";

export type TerminalLocationStatus = "active" | "disabled";
export type TerminalReaderRegistrationStatus = "registered" | "unregistered" | "disabled";
export type TerminalReaderHealthStatus = "healthy" | "unhealthy" | "unknown";
export type TerminalReaderConnectivityStatus = "online" | "offline" | "unknown";
export type TerminalConnectionSessionStatus = "issued" | "expired" | "revoked";
export type CardPresentIntentStatus = "requires_reader" | "processing" | "authorized" | "captured" | "canceled" | "failed";
export type CardPresentCaptureMode = "automatic" | "manual";

export interface TerminalAddress {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly region?: string;
  readonly postalCode: string;
  readonly country: string;
}

export interface TerminalLocation {
  readonly id: TerminalLocationId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly displayName: string;
  readonly status: TerminalLocationStatus;
  readonly address?: TerminalAddress;
  readonly metadata?: Metadata;
  readonly processorRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface TerminalReader {
  readonly id: TerminalReaderId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly locationId: TerminalLocationId;
  readonly label: string;
  readonly registrationStatus: TerminalReaderRegistrationStatus;
  readonly healthStatus: TerminalReaderHealthStatus;
  readonly connectivityStatus: TerminalReaderConnectivityStatus;
  readonly deviceType?: string;
  readonly serialNumberMasked?: string;
  readonly metadata?: Metadata;
  readonly processorRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface TerminalConnectionSession {
  readonly id: TerminalConnectionSessionId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly locationId: TerminalLocationId;
  readonly readerId?: TerminalReaderId;
  readonly status: TerminalConnectionSessionStatus;
  readonly clientToken: string;
  readonly expiresAt: IsoTimestamp;
  readonly createdByType: "operator" | "pos_client" | "system";
  readonly createdByRef: string;
  readonly processorRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface CardPresentCapturePolicy {
  readonly captureMode: CardPresentCaptureMode;
  readonly tipAmount?: number;
  readonly allowTip: boolean;
  readonly allowOvercapture: boolean;
  readonly maxOvercaptureAmount?: number;
}

export interface CardPresentPaymentIntent {
  readonly id: CardPresentPaymentIntentId;
  readonly environment: Environment;
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
  readonly paymentId?: PaymentId;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly metadata?: Metadata;
  readonly processorRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly authorizedAt?: IsoTimestamp;
  readonly capturedAt?: IsoTimestamp;
  readonly canceledAt?: IsoTimestamp;
}
