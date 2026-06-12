import type {
  CancelPaymentIntentCommand,
  CapturePaymentIntentCommand,
  CreatePaymentIntentCommand,
  GetPaymentIntentQuery,
  ListPaymentIntentsQuery,
  PaymentIntentSnapshot,
  RetryPaymentIntentCommand,
} from "./contracts";

export interface PaymentsService {
  createPaymentIntent(command: CreatePaymentIntentCommand): Promise<PaymentIntentSnapshot>;
  getPaymentIntent(query: GetPaymentIntentQuery): Promise<PaymentIntentSnapshot | null>;
  listPaymentIntents(query: ListPaymentIntentsQuery): Promise<readonly PaymentIntentSnapshot[]>;
  capturePaymentIntent(command: CapturePaymentIntentCommand): Promise<PaymentIntentSnapshot>;
  cancelPaymentIntent(command: CancelPaymentIntentCommand): Promise<PaymentIntentSnapshot>;
  retryPaymentIntent(command: RetryPaymentIntentCommand): Promise<PaymentIntentSnapshot>;
}
