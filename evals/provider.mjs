/**
 * Seal AI — Custom promptfoo provider (end-to-end via Convex)
 *
 * Sends messages through the real Convex backend → Gemini Flash + tools pipeline.
 * Uses the dev-only /dev/ai-eval HTTP endpoint which bypasses auth.
 *
 * The response includes:
 * - response: the assistant's text response
 * - toolCalls: array of tool names that were invoked
 * - durationMs: how long the full pipeline took
 */

const CONVEX_SITE_URL =
  process.env.CONVEX_SITE_URL || "https://wooden-poodle-362.convex.site";

export default class SealAIProvider {
  constructor(options = {}) {
    this.documentId = options.config?.documentId;
  }

  id() {
    return "seal-ai:gemini-flash";
  }

  async callApi(prompt) {
    const url = `${CONVEX_SITE_URL}/dev/ai-eval`;

    const body = { prompt };
    if (this.documentId) {
      body.documentId = this.documentId;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      return { error: `HTTP ${res.status}: ${error}` };
    }

    const data = await res.json();

    return {
      output: data.response,
      tokenUsage: {},
      metadata: {
        toolCalls: data.toolCalls,
        durationMs: data.durationMs,
        threadId: data.threadId,
      },
    };
  }
}
