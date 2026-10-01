/**
 * ADR-006 Phase 1 — model provider surface for legal review primitives.
 *
 * Providers stream chat parts. Long runs belong in a Durable Object / Workflow,
 * never the Hono request lifecycle. Registry keys are `provider/model`.
 */

export type StreamPart =
  | { type: "text"; text: string }
  | { type: "tool-call"; id: string; name: string; args: unknown }
  | {
      type: "finish";
      finishReason: { unified: string; raw: string };
      usage?: { inputTokens?: number; outputTokens?: number };
    };

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  /** Max output tokens; providers may clamp. */
  maxTokens?: number;
  temperature?: number;
}

export interface ModelProvider {
  readonly id: string;
  stream(req: ChatRequest): AsyncIterable<StreamPart>;
}

export type ProviderId = "anthropic" | "devin";

export function parseProviderModel(
  keyed: string
): { provider: string; model: string } | null {
  const slash = keyed.indexOf("/");
  if (slash <= 0 || slash === keyed.length - 1) return null;
  return {
    provider: keyed.slice(0, slash),
    model: keyed.slice(slash + 1),
  };
}
