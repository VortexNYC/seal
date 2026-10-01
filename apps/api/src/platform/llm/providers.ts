import { createAnthropicProvider } from "./anthropic.js";
import {
  WORKERS_AI_DEFAULT_MODEL,
  createWorkersAiProvider,
} from "./workers-ai.js";
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
  // Hosted default — runs on Seal's account, no customer key needed.
  if (env.AI && !getProvider("workers-ai")) {
    registerProvider(createWorkersAiProvider(env.AI));
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
 * builtin packs default to anthropic/*, which must degrade to the hosted
 * Workers AI default when no ANTHROPIC_API_KEY is configured.
 */
export function resolveAvailableModel(keyedModel: string): string {
  const slash = keyedModel.indexOf("/");
  if (slash <= 0) return keyedModel;
  const providerId = keyedModel.slice(0, slash);
  if (getProvider(providerId)) return keyedModel;
  if (getProvider("workers-ai")) return `workers-ai/${WORKERS_AI_DEFAULT_MODEL}`;
  if (getProvider("anthropic")) return "anthropic/claude-haiku-4-5-20251001";
  return keyedModel;
}
