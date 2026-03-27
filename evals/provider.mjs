/**
 * Seal AI — Custom promptfoo provider (end-to-end via Convex)
 *
 * Sends messages through the real Convex backend → Gemini Flash + tools pipeline.
 * Uses the dev-only /dev/ai-eval HTTP endpoint which bypasses auth.
 *
 * The response includes:
 * - response: the assistant's text response
 * - toolCalls: array of tool names that were invoked
 * - tierUsed: which model tier handled the request (1=Flash-Lite, 2=Flash, 3=Pro)
 * - durationMs: how long the full pipeline took
 */

const CONVEX_SITE_URL =
	process.env.CONVEX_SITE_URL || "https://wooden-poodle-362.convex.site";

let hasResetState = false;

export default class SealAIProvider {
	constructor(options = {}) {
		this.documentId = options.config?.documentId;
	}

	id() {
		return "seal-ai:gemini-routed";
	}

	async callApi(prompt, context) {
		// Reset eval state once per run to prevent artifact pollution
		if (!hasResetState) {
			hasResetState = true;
			try {
				await fetch(`${CONVEX_SITE_URL}/dev/reset-eval-state`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
				});
			} catch {
				// Non-critical — don't block evals if reset fails
			}
		}

		const url = `${CONVEX_SITE_URL}/dev/ai-eval`;

		// Multi-turn support: vars.conversationJson is a JSON-encoded string[] to
		// avoid promptfoo's array matrix-expansion behavior. Falls back to [prompt].
		const messages = context?.vars?.conversationJson
			? JSON.parse(context.vars.conversationJson)
			: [prompt];

		const body = { messages };
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
				tierUsed: data.tierUsed,
				durationMs: data.durationMs,
				threadId: data.threadId,
			},
		};
	}
}
