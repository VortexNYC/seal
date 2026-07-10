import type {
  CreateCustomerProfileCommand,
  CustomerProfileSnapshot,
  GetCustomerProfileQuery,
  UpdateCustomerProfileCommand,
} from "./contracts";

export interface CustomersService {
  createCustomerProfile(command: CreateCustomerProfileCommand): Promise<CustomerProfileSnapshot>;
  getCustomerProfile(query: GetCustomerProfileQuery): Promise<CustomerProfileSnapshot | null>;
  updateCustomerProfile(command: UpdateCustomerProfileCommand): Promise<CustomerProfileSnapshot>;
}
