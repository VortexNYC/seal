import type {
  CancelCardPresentPaymentIntentCommand,
  CaptureCardPresentPaymentIntentCommand,
  CardPresentPaymentIntentSnapshot,
  CreateCardPresentPaymentIntentCommand,
  CreateTerminalConnectionSessionCommand,
  CreateTerminalLocationCommand,
  GetCardPresentPaymentIntentQuery,
  ListCardPresentPaymentIntentsQuery,
  ListTerminalLocationsQuery,
  ListTerminalReadersQuery,
  RegisterTerminalReaderCommand,
  TerminalConnectionSessionSnapshot,
  TerminalLocationSnapshot,
  TerminalReaderSnapshot,
} from "./contracts";

export interface TerminalService {
  createTerminalLocation(command: CreateTerminalLocationCommand): Promise<TerminalLocationSnapshot>;
  listTerminalLocations(
    query: ListTerminalLocationsQuery,
  ): Promise<readonly TerminalLocationSnapshot[]>;
  registerTerminalReader(command: RegisterTerminalReaderCommand): Promise<TerminalReaderSnapshot>;
  listTerminalReaders(query: ListTerminalReadersQuery): Promise<readonly TerminalReaderSnapshot[]>;
  createTerminalConnectionSession(
    command: CreateTerminalConnectionSessionCommand,
  ): Promise<TerminalConnectionSessionSnapshot>;
  createCardPresentPaymentIntent(
    command: CreateCardPresentPaymentIntentCommand,
  ): Promise<CardPresentPaymentIntentSnapshot>;
  getCardPresentPaymentIntent(
    query: GetCardPresentPaymentIntentQuery,
  ): Promise<CardPresentPaymentIntentSnapshot | null>;
  listCardPresentPaymentIntents(
    query: ListCardPresentPaymentIntentsQuery,
  ): Promise<readonly CardPresentPaymentIntentSnapshot[]>;
  captureCardPresentPaymentIntent(
    command: CaptureCardPresentPaymentIntentCommand,
  ): Promise<CardPresentPaymentIntentSnapshot>;
  cancelCardPresentPaymentIntent(
    command: CancelCardPresentPaymentIntentCommand,
  ): Promise<CardPresentPaymentIntentSnapshot>;
}
