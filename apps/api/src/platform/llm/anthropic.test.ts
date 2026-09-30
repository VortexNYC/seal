import { describe, expect, it } from "vitest";

import { createAnthropicProvider } from "./anthropic.js";
import type { StreamPart } from "./types.js";

function sseResponse(frames: string): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(frames));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

function anthropicSse(parts: {
  inputTokens?: number;
  text: string;
  stopReason?: string;
  outputTokens?: number;
}): string {
  return [
    `event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","usage":{"input_tokens":${parts.inputTokens ?? 0}}}}\n\n`,
    `event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`,
    `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":${JSON.stringify(parts.text)}}}\n\n`,
    `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`,
    `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"${parts.stopReason ?? "end_turn"}"},"usage":{"output_tokens":${parts.outputTokens ?? 0}}}\n\n`,
    `event: message_stop\ndata: {"type":"message_stop"}\n\n`,
  ].join("");
}

async function collect(
  parts: AsyncIterable<StreamPart>
): Promise<StreamPart[]> {
  const out: StreamPart[] = [];
  for await (const part of parts) out.push(part);
  return out;
}

describe("anthropic provider", () => {
  it("streams text deltas and normalized finish with usage", async () => {
    let seenBody: string | undefined;
    const provider = createAnthropicProvider({
      apiKey: "sk-test",
      fetchImpl: async (url, init) => {
        expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
        seenBody = String(init?.body ?? "");
        return sseResponse(
          anthropicSse({
            inputTokens: 11,
            text: "hello world",
            stopReason: "end_turn",
            outputTokens: 4,
          })
        );
      },
    });

    const parts = await collect(
      provider.stream({
        model: "claude-haiku-4-5-20251001",
        messages: [
          { role: "system", content: "be terse" },
          { role: "user", content: "hi" },
        ],
      })
    );

    const text = parts
      .filter((p) => p.type === "text")
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("");
    expect(text).toBe("hello world");

    const finish = parts.find((p) => p.type === "finish");
    expect(finish?.type === "finish" && finish.finishReason).toEqual({
      unified: "stop",
      raw: "end_turn",
    });
    expect(finish?.type === "finish" && finish.usage).toEqual({
      inputTokens: 11,
      outputTokens: 4,
    });

    const sent = JSON.parse(seenBody ?? "{}") as {
      stream?: boolean;
      system?: string;
      messages?: { role: string; content: string }[];
      model?: string;
    };
    expect(sent.stream).toBe(true);
    expect(sent.system).toBe("be terse");
    expect(sent.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(sent.model).toBe("claude-haiku-4-5-20251001");
  });

  it("maps max_tokens to unified length", async () => {
    const provider = createAnthropicProvider({
      apiKey: "sk-test",
      fetchImpl: async () =>
        sseResponse(
          anthropicSse({ text: "trunc", stopReason: "max_tokens" })
        ),
    });
    const parts = await collect(
      provider.stream({
        model: "m",
        messages: [{ role: "user", content: "x" }],
      })
    );
    const finish = parts.find((p) => p.type === "finish");
    expect(finish?.type === "finish" && finish.finishReason.unified).toBe(
      "length"
    );
  });

  it("throws on non-2xx with the body", async () => {
    const provider = createAnthropicProvider({
      apiKey: "sk-test",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { message: "bad key" } }), {
          status: 401,
        }),
    });
    await expect(
      collect(
        provider.stream({
          model: "m",
          messages: [{ role: "user", content: "x" }],
        })
      )
    ).rejects.toThrow(/401/);
  });
});
