import type { Address, PlatformTenantId } from "../../domain/common";
import type {
  MerchantAssociatedIdentity,
  MerchantMode,
  MerchantProfileDate,
  MerchantSettlementBankAccount,
  MerchantUnderwritingData,
} from "../../domain/merchant";
import type { MetadataCarrier } from "./common";

export interface CreateMerchantAccountRequest extends MetadataCarrier {
  readonly tenantId: PlatformTenantId;
  readonly externalMerchantRef?: string;
  readonly displayName: string;
  readonly legalEntityType: string;
  readonly country: string;
  readonly merchantMode: MerchantMode;
  readonly defaultCurrency: string;
  readonly businessAddress?: Address;
  readonly personalAddress?: Address;
  readonly doingBusinessAs?: string;
  readonly businessPhone?: string;
  readonly businessTaxId?: string;
  readonly phone?: string;
  readonly taxId?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly dateOfBirth?: MerchantProfileDate;
  readonly incorporationDate?: MerchantProfileDate;
  readonly maxTransactionAmount?: number;
  readonly achMaxTransactionAmount?: number;
  readonly annualCardVolume?: number;
  readonly mcc?: string;
  readonly url?: string;
  readonly principalPercentageOwnership?: number;
  readonly hasAcceptedCreditCardsPreviously?: boolean;
  readonly settlementBankAccount?: MerchantSettlementBankAccount;
  readonly associatedIdentities?: readonly MerchantAssociatedIdentity[];
  readonly underwriting?: MerchantUnderwritingData;
}

export interface UpdateMerchantAccountRequest {
  readonly displayName?: string;
  readonly merchantMode?: MerchantMode;
  readonly businessAddress?: Address | null;
  readonly personalAddress?: Address | null;
  readonly doingBusinessAs?: string | null;
  readonly businessPhone?: string | null;
  readonly businessTaxId?: string | null;
  readonly phone?: string | null;
  readonly taxId?: string | null;
  readonly email?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly dateOfBirth?: MerchantProfileDate | null;
  readonly incorporationDate?: MerchantProfileDate | null;
  readonly maxTransactionAmount?: number | null;
  readonly achMaxTransactionAmount?: number | null;
  readonly annualCardVolume?: number | null;
  readonly mcc?: string | null;
  readonly url?: string | null;
  readonly principalPercentageOwnership?: number | null;
  readonly hasAcceptedCreditCardsPreviously?: boolean | null;
  readonly settlementBankAccount?: MerchantSettlementBankAccount | null;
  readonly associatedIdentities?: readonly MerchantAssociatedIdentity[] | null;
  readonly underwriting?: MerchantUnderwritingData | null;
  readonly metadata?: Readonly<Record<string, string>> | null;
}
