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
