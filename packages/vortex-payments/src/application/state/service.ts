import type {
  GetCustomerPaymentStateQuery,
  GetMerchantAccountCapabilitiesQuery,
  GetMerchantAccountStateQuery,
  MerchantStateReader,
} from "./contracts";

export interface PaymentsStateReader extends MerchantStateReader {
  getMerchantAccountState(query: GetMerchantAccountStateQuery): ReturnType<MerchantStateReader["getMerchantAccountState"]>;
  getMerchantAccountCapabilities(
    query: GetMerchantAccountCapabilitiesQuery,
  ): ReturnType<MerchantStateReader["getMerchantAccountCapabilities"]>;
  getCustomerPaymentState(query: GetCustomerPaymentStateQuery): ReturnType<MerchantStateReader["getCustomerPaymentState"]>;
}
