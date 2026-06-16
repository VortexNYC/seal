import type { CustomerProfileId, MerchantAccountId } from "../../domain/common";
import type { CursorPage, MetadataCarrier } from "./common";

export interface CustomerProfileResponse extends MetadataCarrier {
  readonly id: CustomerProfileId;
  readonly merchantAccountId: MerchantAccountId;
  readonly externalCustomerId?: string;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
}

export interface CreateCustomerProfileRequest extends MetadataCarrier {
  readonly merchantAccountId: MerchantAccountId;
  readonly externalCustomerId?: string;
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
}

export interface UpdateCustomerProfileRequest extends MetadataCarrier {
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
}

export interface CustomerProfileListResponse extends CursorPage<CustomerProfileResponse> {}
