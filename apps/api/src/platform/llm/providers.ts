import { createAnthropicProvider } from "./anthropic.js";
import {
  createEchoProvider,
  getProvider,
  registerProvider,
} from "./registry.js";

/**
 * Register providers that are usable in this environment. `echo` is always
 * available (dev/tests); `anthropic` registers only when the secret exists —
 * a missing key must degrade to "unknown provider", never fail closed at boot.
 */
export function ensureProvidersRegistered(env: CloudflareBindings): void {
  if (!getProvider("echo")) {
    registerProvider(createEchoProvider());
  }
  if (
    typeof env.ANTHROPIC_API_KEY === "string" &&
    env.ANTHROPIC_API_KEY.length > 0 &&
    !getProvider("anthropic")
  ) {
    registerProvider(
      createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY })
    );
  }
}

/**
 * Resolve a keyed model to a provider that is actually registered —
 * builtin packs default to anthropic/*; degrade to the registered
 * anthropic provider when a pinned provider is not configured.
 */
export function resolveAvailableModel(keyedModel: string): string {
  const slash = keyedModel.indexOf("/");
  if (slash <= 0) return keyedModel;
  const providerId = keyedModel.slice(0, slash);
  if (getProvider(providerId)) return keyedModel;
  if (getProvider("anthropic")) return "anthropic/claude-haiku-4-5-20251001";
  return keyedModel;
}
