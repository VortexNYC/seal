import { Transaction } from "./types";

export function computeLedgerBalance(transactions: Transaction[]): number {
  if (transactions.length === 0) {
    return 0;
  }

  return transactions.reduce((sum, t) => sum + t.amount, 0);
}
