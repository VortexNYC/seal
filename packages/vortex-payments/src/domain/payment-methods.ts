import type {
  Address,
  CustomerProfileId,
  Environment,
  IsoTimestamp,
  MerchantAccountId,
  Metadata,
  PaymentMethodId,
  PaymentMethodSetupSessionId,
  PayoutAccountId,
  ProcessorRef,
} from "./common";

export interface CustomerProfile {
  readonly id: CustomerProfileId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly externalCustomerId?: string;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly address?: Address;
  readonly metadata?: Metadata;
  readonly processorCustomerRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type PaymentMethodOwnerType = "customer" | "merchant";
export type PaymentMethodStatus = "active" | "disabled" | "archived";
export type PaymentMethodSetupSessionStatus =
  | "pending_tokenization"
  | "tokenized"
  | "consuming"
  | "consumed"
  | "expired"
  | "canceled"
  | "failed";

export interface PaymentMethodSetupSession {
  readonly id: PaymentMethodSetupSessionId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly ownerType: PaymentMethodOwnerType;
  readonly ownerId: string;
  readonly methodType: string;
  readonly provider: string;
  readonly clientSecret: string;
  readonly status: PaymentMethodSetupSessionStatus;
  readonly setAsDefault: boolean;
  readonly expiresAt: IsoTimestamp;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly consumedAt?: IsoTimestamp;
  readonly attachedPaymentMethodId?: PaymentMethodId;
}

export interface PaymentMethod {
  readonly id: PaymentMethodId;
  readonly environment: Environment;
  readonly merchantAccountId?: MerchantAccountId;
  readonly ownerType: PaymentMethodOwnerType;
  readonly ownerId: string;
  readonly methodType: string;
  readonly brandSummary?: string;
  readonly last4?: string;
  readonly expiryMonth?: number;
  readonly expiryYear?: number;
  readonly status: PaymentMethodStatus;
  readonly isDefault: boolean;
  readonly fingerprint?: string;
  readonly processorInstrumentRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly archivedAt?: IsoTimestamp;
}

export type PayoutAccountStatus = "active" | "disabled" | "archived";

export interface PayoutAccount {
  readonly id: PayoutAccountId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly methodType: string;
  readonly bankSummary?: string;
  readonly cardSummary?: string;
  readonly status: PayoutAccountStatus;
  readonly isDefault: boolean;
  readonly processorRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly archivedAt?: IsoTimestamp;
}
