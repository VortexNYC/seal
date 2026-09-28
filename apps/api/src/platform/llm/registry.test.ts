import { describe, expect, test } from "vitest";

import {
  createEchoProvider,
  listProviders,
  parseProviderModel,
  registerProvider,
  streamKeyedModel,
} from "./index.js";

describe("llm registry", () => {
  test("parseProviderModel splits provider/model", () => {
    expect(parseProviderModel("anthropic/claude-sonnet-4-5")).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-5",
    });
    expect(parseProviderModel("bad")).toBeNull();
  });

  test("echo provider streams text then finish", async () => {
    registerProvider(createEchoProvider());
    expect(listProviders()).toContain("echo");

    const parts = [];
    for await (const part of streamKeyedModel("echo/test", {
      messages: [{ role: "user", content: "hello legal" }],
    })) {
      parts.push(part);
    }

    expect(parts).toEqual([
      { type: "text", text: "hello legal" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: "stop" },
      },
    ]);
  });
});
