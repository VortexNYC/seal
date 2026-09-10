import { describe, expect, it } from "vitest";

import { DEFAULT_CHAT_MODEL } from "./ai.js";

describe("ai model provider", () => {
  it("uses a Cloudflare Workers AI chat model by default", () => {
    expect(DEFAULT_CHAT_MODEL).toMatch(/^@cf\/.+/);
  });
});
