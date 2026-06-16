import type {
  Address,
  Environment,
  MerchantAccountId,
  Metadata,
  PlatformTenantId,
} from "../../domain/common";
import type {
  MerchantAccount,
  MerchantAssociatedIdentity,
  MerchantMode,
  MerchantProfileDate,
  MerchantSettlementBankAccount,
  MerchantUnderwritingData,
} from "../../domain/merchant";

export interface CreateMerchantAccountCommand {
  readonly environment: Environment;
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
  readonly metadata?: Metadata;
}

export interface UpdateMerchantAccountCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
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
  readonly metadata?: Metadata | null;
}

export interface ListMerchantAccountsQuery {
  readonly environment: Environment;
  readonly tenantId: PlatformTenantId;
}

export interface GetMerchantAccountQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
}

export interface MerchantTaxIdentitySnapshot {
  readonly businessTaxIdMasked?: string;
  readonly personalTaxIdMasked?: string;
  readonly associatedIdentityCount: number;
  readonly beneficialOwnerCount: number;
  readonly controlPersonCount: number;
  readonly representativeCount: number;
}

export interface MerchantSettlementAccountSnapshot {
  readonly present: boolean;
  readonly accountType?: string;
  readonly bankCode?: string;
  readonly accountNumberMasked?: string;
  readonly name?: string;
}

export interface MerchantAccountSnapshot {
  readonly id: MerchantAccount["id"];
  readonly environment: MerchantAccount["environment"];
  readonly tenantId: MerchantAccount["tenantId"];
  readonly externalMerchantRef?: MerchantAccount["externalMerchantRef"];
  readonly displayName: MerchantAccount["displayName"];
  readonly legalEntityType: MerchantAccount["legalEntityType"];
  readonly country: MerchantAccount["country"];
  readonly merchantMode: MerchantAccount["merchantMode"];
  readonly defaultCurrency: MerchantAccount["defaultCurrency"];
  readonly status: MerchantAccount["status"];
  readonly capabilityStatus: MerchantAccount["capabilityStatus"];
  readonly businessAddress?: MerchantAccount["businessAddress"];
  readonly personalAddress?: MerchantAccount["personalAddress"];
  readonly doingBusinessAs?: MerchantAccount["doingBusinessAs"];
  readonly businessPhone?: MerchantAccount["businessPhone"];
  readonly phone?: MerchantAccount["phone"];
  readonly email?: MerchantAccount["email"];
  readonly firstName?: MerchantAccount["firstName"];
  readonly lastName?: MerchantAccount["lastName"];
  readonly dateOfBirth?: MerchantAccount["dateOfBirth"];
  readonly incorporationDate?: MerchantAccount["incorporationDate"];
  readonly maxTransactionAmount?: MerchantAccount["maxTransactionAmount"];
  readonly achMaxTransactionAmount?: MerchantAccount["achMaxTransactionAmount"];
  readonly annualCardVolume?: MerchantAccount["annualCardVolume"];
  readonly mcc?: MerchantAccount["mcc"];
  readonly url?: MerchantAccount["url"];
  readonly principalPercentageOwnership?: MerchantAccount["principalPercentageOwnership"];
  readonly hasAcceptedCreditCardsPreviously?: MerchantAccount["hasAcceptedCreditCardsPreviously"];
  readonly taxIdentity: MerchantTaxIdentitySnapshot;
  readonly settlementAccount: MerchantSettlementAccountSnapshot;
  readonly underwriting?: MerchantAccount["underwriting"];
  readonly metadata?: MerchantAccount["metadata"];
  readonly createdAt: MerchantAccount["createdAt"];
  readonly updatedAt: MerchantAccount["updatedAt"];
}

export type MerchantAccountList = readonly MerchantAccountSnapshot[];
