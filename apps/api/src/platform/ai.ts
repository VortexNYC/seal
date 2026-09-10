import { createGateway } from "ai";

export type AIModelEnv = Pick<
  CloudflareBindings,
  "AI_GATEWAY_API_KEY" | "AI_GATEWAY_BASE_URL"
>;

export function getModelProvider(env: AIModelEnv) {
  return createGateway({
    apiKey: env.AI_GATEWAY_API_KEY,
    baseURL: env.AI_GATEWAY_BASE_URL,
  });
}

export const DEFAULT_CHAT_MODEL = "google/gemini-3-flash" as const;
