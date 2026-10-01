import { describe, expect, it } from "vitest";

import { createWorkersAiProvider } from "./workers-ai.js";
import type { StreamPart } from "./types.js";

async function collect(
  parts: AsyncIterable<StreamPart>
): Promise<StreamPart[]> {
  const out: StreamPart[] = [];
  for await (const part of parts) out.push(part);
  return out;
}

type FakeAi = Parameters<typeof createWorkersAiProvider>[0];

function fakeAi(run: (model: string, input: unknown) => unknown): FakeAi {
  return {
    run: ((model: string, input: unknown) =>
      Promise.resolve(run(model, input))) as FakeAi["run"],
  };
}

function sseStream(frames: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(frames));
      controller.close();
    },
  });
}

describe("workers-ai provider", () => {
  it("streams SSE response frames into text parts", async () => {
    const ai = fakeAi(() =>
      sseStream(
        `data: {"response":"Hello "}\n\ndata: {"response":"world"}\n\ndata: [DONE]\n\n`
      )
    );
    const provider = createWorkersAiProvider(ai);
    const parts = await collect(
      provider.stream({
        model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        messages: [{ role: "user", content: "hi" }],
      })
    );
    const text = parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");
    expect(text).toBe("Hello world");
    expect(parts.at(-1)?.type).toBe("finish");
  });

  it("forwards model + messages to the binding", async () => {
    const seen: { model?: string; input?: unknown } = {};
    const ai = fakeAi((model, input) => {
      seen.model = model;
      seen.input = input;
      return sseStream(`data: {"response":"ok"}\n\ndata: [DONE]\n\n`);
    });
    const provider = createWorkersAiProvider(ai);
    await collect(
      provider.stream({
        model: "@cf/meta/llama-3.1-8b-instruct",
        messages: [
          { role: "system", content: "sys" },
          { role: "user", content: "u" },
        ],
        maxTokens: 128,
        temperature: 0.2,
      })
    );
    expect(seen.model).toBe("@cf/meta/llama-3.1-8b-instruct");
    const input = seen.input as {
      messages: Array<{ role: string; content: string }>;
      max_tokens: number;
      temperature: number;
      stream: boolean;
    };
    expect(input.messages).toHaveLength(2);
    expect(input.max_tokens).toBe(128);
    expect(input.temperature).toBe(0.2);
    expect(input.stream).toBe(true);
  });

  it("handles non-streamed {response} shape", async () => {
    const ai = fakeAi(() => ({
      response: "plain answer",
      usage: { prompt_tokens: 10, completion_tokens: 4 },
    }));
    const provider = createWorkersAiProvider(ai);
    const parts = await collect(
      provider.stream({
        model: "m",
        messages: [{ role: "user", content: "hi" }],
      })
    );
    expect(parts[0]).toEqual({ type: "text", text: "plain answer" });
    const finish = parts.at(-1);
    expect(finish?.type).toBe("finish");
    if (finish?.type === "finish") {
      expect(finish.usage?.inputTokens).toBe(10);
      expect(finish.usage?.outputTokens).toBe(4);
    }
  });
});
