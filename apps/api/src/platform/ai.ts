import { createWorkersAI } from "workers-ai-provider";

export type AIModelEnv = Pick<CloudflareBindings, "AI">;

export function getModelProvider(env: AIModelEnv) {
  return createWorkersAI({ binding: env.AI });
}

export const DEFAULT_CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct" as const;
