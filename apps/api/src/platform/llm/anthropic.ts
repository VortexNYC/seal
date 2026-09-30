import type { ChatRequest, ModelProvider, StreamPart } from "./types.js";

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_MAX_TOKENS = 2048;

export interface AnthropicProviderOptions {
  apiKey: string;
  /** Defaults to api.anthropic.com — override for tests/proxies. */
  baseUrl?: string;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

interface AnthropicSseEvent {
  event: string;
  data: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function unifiedFinishReason(stopReason: string | null): string {
  switch (stopReason) {
    case "end_turn":
    case "stop_sequence":
      return "stop";
    case "max_tokens":
      return "length";
    case "tool_use":
      return "tool-calls";
    default:
      return stopReason ?? "other";
  }
}

/**
 * Anthropic Messages API provider (ADR-006 Phase 1).
 *
 * Anthropic's zero-retention terms make it the default provider for legal
 * review work. Streams SSE and normalizes `finishReason` into the
 * `{unified, raw}` shape — bare strings break downstream tool loops.
 */
export function createAnthropicProvider(
  options: AnthropicProviderOptions
): ModelProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;

  async function* streamEvents(
    response: Response
  ): AsyncIterable<AnthropicSseEvent> {
    if (!response.body) {
      throw new Error(`anthropic: empty response body (${response.status})`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line.
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          let event = "message";
          let data = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) {
              data += data ? `\n${line.slice(5).trim()}` : line.slice(5).trim();
            }
          }
          if (data) {
            let parsed: unknown = data;
            try {
              parsed = JSON.parse(data);
            } catch {
              // Keep the raw string; non-JSON frames are ignored downstream.
            }
            yield { event, data: parsed };
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  return {
    id: "anthropic",
    async *stream(req: ChatRequest): AsyncIterable<StreamPart> {
      const system = req.messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const messages = req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetchImpl(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": options.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: req.model,
          max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
          temperature: req.temperature,
          stream: true,
          ...(system ? { system } : {}),
          messages,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`anthropic: ${response.status} ${body.slice(0, 300)}`);
      }

      let stopReason: string | null = null;
      const usage: { inputTokens?: number; outputTokens?: number } = {};

      for await (const { event, data } of streamEvents(response)) {
        const record = asRecord(data);
        if (event === "error") {
          const message = asString(asRecord(record?.error)?.message);
          throw new Error(`anthropic stream error: ${message ?? "unknown"}`);
        }
        if (!record) continue;

        if (event === "message_start") {
          const messageUsage = asRecord(asRecord(record.message)?.usage);
          const inputTokens = asNumber(messageUsage?.input_tokens);
          if (inputTokens !== null) usage.inputTokens = inputTokens;
        } else if (event === "content_block_delta") {
          const delta = asRecord(record.delta);
          const text = asString(delta?.text);
          if (delta?.type === "text_delta" && text) {
            yield { type: "text", text };
          }
        } else if (event === "message_delta") {
          const delta = asRecord(record.delta);
          stopReason = asString(delta?.stop_reason) ?? stopReason;
          const messageUsage = asRecord(record.usage);
          const outputTokens = asNumber(messageUsage?.output_tokens);
          if (outputTokens !== null) usage.outputTokens = outputTokens;
        } else if (event === "message_stop") {
          yield {
            type: "finish",
            finishReason: {
              unified: unifiedFinishReason(stopReason),
              raw: stopReason ?? "unknown",
            },
            usage,
          };
          return;
        }
      }

      // Stream ended without message_stop — still report a finish.
      yield {
        type: "finish",
        finishReason: {
          unified: unifiedFinishReason(stopReason),
          raw: stopReason ?? "unknown",
        },
        usage,
      };
    },
  };
}
