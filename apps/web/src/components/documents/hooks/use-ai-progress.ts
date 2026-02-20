import { useQuery } from "convex/react";

import { api } from "@seal/backend/convex/_generated/api";

/**
 * Subscribes to AI progress for a given thread.
 * Returns step/tool tracking info and status.
 */
export function useAIProgress(threadId: string | null) {
  const progress = useQuery(api.ai.progress.get, threadId ? { threadId } : "skip");

  return {
    step: progress?.step ?? 0,
    totalSteps: progress?.totalSteps ?? undefined,
    completedTools: progress?.completedTools ?? [],
    tokensUsed: progress?.tokensUsed ?? 0,
    status: progress?.status ?? null,
    error: progress?.error ?? null,
    isTracking: progress?.status === "in_progress",
    isCompleted: progress?.status === "completed",
    isFailed: progress?.status === "failed",
    isAborted: progress?.status === "aborted",
  };
}
