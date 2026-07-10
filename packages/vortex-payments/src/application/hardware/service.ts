import type {
  CancelPaymentHardwareOrderCommand,
  CreatePaymentHardwareOrderCommand,
  GetPaymentHardwareOrderQuery,
  ListPaymentHardwareOrdersQuery,
  ListPaymentHardwareSkusQuery,
  PaymentHardwareOrderPreview,
  PaymentHardwareOrderSnapshot,
  PaymentHardwareReturnSnapshot,
  PaymentHardwareSkuSnapshot,
  PreviewPaymentHardwareOrderCommand,
  RequestPaymentHardwareReturnCommand,
  UpsertPaymentHardwareSkuCommand,
} from "./contracts";

export interface PaymentHardwareService {
  upsertSku(command: UpsertPaymentHardwareSkuCommand): Promise<PaymentHardwareSkuSnapshot>;
  listSkus(query: ListPaymentHardwareSkusQuery): Promise<readonly PaymentHardwareSkuSnapshot[]>;
  previewOrder(command: PreviewPaymentHardwareOrderCommand): Promise<PaymentHardwareOrderPreview>;
  createOrder(command: CreatePaymentHardwareOrderCommand): Promise<PaymentHardwareOrderSnapshot>;
  getOrder(query: GetPaymentHardwareOrderQuery): Promise<PaymentHardwareOrderSnapshot | null>;
  listOrders(
    query: ListPaymentHardwareOrdersQuery,
  ): Promise<readonly PaymentHardwareOrderSnapshot[]>;
  cancelOrder(command: CancelPaymentHardwareOrderCommand): Promise<PaymentHardwareOrderSnapshot>;
  requestReturn(
    command: RequestPaymentHardwareReturnCommand,
  ): Promise<PaymentHardwareReturnSnapshot>;
}
