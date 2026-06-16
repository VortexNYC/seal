import type {
  CreatePaymentMethodFromSetupCommand,
  CreatePaymentMethodSetupSessionCommand,
  CreatedPaymentMethodSnapshot,
  PaymentMethodSetupSessionSnapshot,
} from "./contracts";

export interface PaymentMethodSetupService {
  createPaymentMethodSetupSession(
    command: CreatePaymentMethodSetupSessionCommand,
  ): Promise<PaymentMethodSetupSessionSnapshot>;
  createPaymentMethodFromSetup(
    command: CreatePaymentMethodFromSetupCommand,
  ): Promise<CreatedPaymentMethodSnapshot>;
}
