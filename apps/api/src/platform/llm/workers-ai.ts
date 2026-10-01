import type { ChatRequest, ModelProvider, StreamPart } from "./types.js";

/**
 * Cloudflare Workers AI provider — the hosted default. Runs on Seal's own
 * account via the AI binding, so review models work with no customer key.
 */

export const WORKERS_AI_DEFAULT_MODEL =
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

interface WorkersAiEnv {
  run(
    model: string,
    input: {
      messages: Array<{ role: string; content: string }>;
      stream?: boolean;
      max_tokens?: number;
      temperature?: number;
    }
  ): Promise<ReadableStream<Uint8Array> | { response?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function createWorkersAiProvider(ai: WorkersAiEnv): ModelProvider {
  return {
    id: "workers-ai",
    async *stream(req: ChatRequest): AsyncIterable<StreamPart> {
      const messages = req.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await ai.run(req.model, {
        messages,
        stream: true,
        max_tokens: req.maxTokens ?? 2048,
        temperature: req.temperature,
      });

      // stream:true → SSE of {"response": "..."} data frames.
      if (result instanceof ReadableStream) {
        const reader = result.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.indexOf("\n\n");
            while (boundary !== -1) {
              const frame = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              for (const line of frame.split("\n")) {
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (payload === "[DONE]") continue;
                try {
                  const parsed = asRecord(JSON.parse(payload));
                  const text = parsed?.response;
                  if (typeof text === "string" && text) {
                    yield { type: "text", text };
                  }
                } catch {
                  // partial frame — ignored
                }
              }
              boundary = buffer.indexOf("\n\n");
            }
          }
        } finally {
          reader.releaseLock();
        }
        yield {
          type: "finish",
          finishReason: { unified: "stop", raw: "stop" },
        };
        return;
      }

      // Non-streamed shape fallback ({ response, usage }).
      const text = typeof result.response === "string" ? result.response : "";
      if (text) yield { type: "text", text };
      yield {
        type: "finish",
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: result.usage?.prompt_tokens,
          outputTokens: result.usage?.completion_tokens,
        },
      };
    },
  };
}
