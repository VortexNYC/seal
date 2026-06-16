import type {
  DisputeRepository,
  CustomerProfileRepository,
  CustomerStateRepository,
  EventRepository,
  IdempotencyRepository,
  MerchantAccountRepository,
  MerchantOnboardingRepository,
  MerchantStateRepository,
  OperatorCaseRepository,
  PaymentHardwareOrderRepository,
  PaymentHardwareReturnRepository,
  PaymentHardwareSkuRepository,
  PaymentIntentRepository,
  PaymentMethodRepository,
  PaymentMethodSetupSessionRepository,
  PaymentRepository,
  PayoutRepository,
  RefundRepository,
  SellerPayoutProfileSnapshotRepository,
  SettlementLineageEntryRepository,
  SettlementRepository,
  TerminalConnectionSessionRepository,
  TerminalLocationRepository,
  TerminalReaderRepository,
  CardPresentPaymentIntentRepository,
} from "./repositories";

export interface PaymentsUnitOfWork {
  readonly merchants: MerchantAccountRepository;
  readonly customers: CustomerProfileRepository;
  readonly onboarding: MerchantOnboardingRepository;
  readonly merchantStates: MerchantStateRepository;
  readonly customerStates: CustomerStateRepository;
  readonly paymentMethods: PaymentMethodRepository;
  readonly paymentMethodSetupSessions: PaymentMethodSetupSessionRepository;
  readonly paymentIntents: PaymentIntentRepository;
  readonly payments: PaymentRepository;
  readonly refunds: RefundRepository;
  readonly settlements: SettlementRepository;
  readonly payouts: PayoutRepository;
  readonly settlementLineageEntries?: SettlementLineageEntryRepository;
  readonly sellerPayoutProfileSnapshots?: SellerPayoutProfileSnapshotRepository;
  readonly disputes: DisputeRepository;
  readonly terminalLocations?: TerminalLocationRepository;
  readonly terminalReaders?: TerminalReaderRepository;
  readonly terminalConnectionSessions?: TerminalConnectionSessionRepository;
  readonly cardPresentPaymentIntents?: CardPresentPaymentIntentRepository;
  readonly paymentHardwareSkus?: PaymentHardwareSkuRepository;
  readonly paymentHardwareOrders?: PaymentHardwareOrderRepository;
  readonly paymentHardwareReturns?: PaymentHardwareReturnRepository;
  readonly events: EventRepository;
  readonly cases: OperatorCaseRepository;
  readonly idempotency: IdempotencyRepository;
  runInTransaction<T>(work: (uow: PaymentsUnitOfWork) => Promise<T>): Promise<T>;
}
