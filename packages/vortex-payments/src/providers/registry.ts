import type { PaymentsProviderAdapter, ProviderKey } from "./types";

export interface ProviderRegistry {
  getAdapter(provider: ProviderKey): PaymentsProviderAdapter;
  listAdapters(): readonly PaymentsProviderAdapter[];
}
