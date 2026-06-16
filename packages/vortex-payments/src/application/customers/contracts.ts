import type {
  CustomerProfileId,
  Environment,
  MerchantAccountId,
  Metadata,
} from "../../domain/common";

export interface CreateCustomerProfileCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly externalCustomerId?: string;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly metadata?: Metadata;
}

export interface UpdateCustomerProfileCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId: CustomerProfileId;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly metadata?: Metadata;
}

export interface GetCustomerProfileQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId: CustomerProfileId;
}

export interface CustomerProfileSnapshot {
  readonly id: CustomerProfileId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly externalCustomerId?: string;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly metadata?: Metadata;
}
