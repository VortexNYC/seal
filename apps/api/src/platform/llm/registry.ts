import type { ChatRequest, ModelProvider, StreamPart } from "./types.js";
import { parseProviderModel } from "./types.js";

/**
 * In-process registry. Wire Anthropic / Workers AI / Devin behind flags —
 * do not call this from request handlers for long runs.
 */
const providers = new Map<string, ModelProvider>();

export function registerProvider(provider: ModelProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): ModelProvider | undefined {
  return providers.get(id);
}

export function listProviders(): string[] {
  return [...providers.keys()].sort();
}

export async function* streamKeyedModel(
  keyedModel: string,
  req: Omit<ChatRequest, "model">
): AsyncIterable<StreamPart> {
  const parsed = parseProviderModel(keyedModel);
  if (!parsed) {
    throw new Error(`invalid provider/model key: ${keyedModel}`);
  }
  const provider = getProvider(parsed.provider);
  if (!provider) {
    throw new Error(`unknown provider: ${parsed.provider}`);
  }
  yield* provider.stream({ ...req, model: parsed.model });
}

/** Dev-only stub — echoes the last user message as a single text part. */
export function createEchoProvider(): ModelProvider {
  return {
    id: "echo",
    async *stream(req: ChatRequest): AsyncIterable<StreamPart> {
      const lastUser = [...req.messages]
        .reverse()
        .find((m) => m.role === "user");
      yield { type: "text", text: lastUser?.content ?? "" };
      yield {
        type: "finish",
        finishReason: { unified: "stop", raw: "stop" },
      };
    },
  };
}
