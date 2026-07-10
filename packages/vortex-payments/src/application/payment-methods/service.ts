import type {
  ArchivePaymentMethodCommand,
  CustomerPaymentStateSnapshot,
  DisablePaymentMethodCommand,
  GetCustomerPaymentMethodQuery,
  ListCustomerPaymentMethodsQuery,
  PaymentMethodSnapshot,
  SetDefaultCustomerPaymentMethodCommand,
} from "./contracts";

export interface PaymentMethodsService {
  listCustomerPaymentMethods(
    query: ListCustomerPaymentMethodsQuery,
  ): Promise<readonly PaymentMethodSnapshot[]>;
  getCustomerPaymentMethod(
    query: GetCustomerPaymentMethodQuery,
  ): Promise<PaymentMethodSnapshot | null>;
  setDefaultCustomerPaymentMethod(
    command: SetDefaultCustomerPaymentMethodCommand,
  ): Promise<readonly PaymentMethodSnapshot[]>;
  archivePaymentMethod(command: ArchivePaymentMethodCommand): Promise<PaymentMethodSnapshot>;
  disablePaymentMethod(command: DisablePaymentMethodCommand): Promise<PaymentMethodSnapshot>;
  getCustomerPaymentState(
    query: ListCustomerPaymentMethodsQuery,
  ): Promise<CustomerPaymentStateSnapshot>;
}
