import type {
  CreateMerchantAccountCommand,
  GetMerchantAccountQuery,
  ListMerchantAccountsQuery,
  MerchantAccountList,
  MerchantAccountSnapshot,
  UpdateMerchantAccountCommand,
} from "./contracts";

export interface MerchantAccountsService {
  createMerchantAccount(command: CreateMerchantAccountCommand): Promise<MerchantAccountSnapshot>;
  listMerchantAccounts(query: ListMerchantAccountsQuery): Promise<MerchantAccountList>;
  getMerchantAccount(query: GetMerchantAccountQuery): Promise<MerchantAccountSnapshot | null>;
  updateMerchantAccount(command: UpdateMerchantAccountCommand): Promise<MerchantAccountSnapshot>;
}
