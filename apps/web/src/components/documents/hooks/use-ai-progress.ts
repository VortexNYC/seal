import { api } from "@seal/backend/convex/_generated/api";
import { useQuery } from "convex/react";

/**
 * Subscribes to AI progress for a given thread.
 * Returns step/tool tracking info and status.
 */
export function useAIProgress(threadId: string | null) {
  const progress = useQuery(
    api.ai.progress.get,
    threadId ? { threadId } : "skip"
  );
  const status = progress?.status ?? null;

  return {
    step: progress?.step ?? 0,
    totalSteps: progress?.totalSteps ?? undefined,
    completedTools: progress?.completedTools ?? [],
    tokensUsed: progress?.tokensUsed ?? 0,
    status,
    error: progress?.error ?? null,
    isTracking: status === "in_progress",
    isCompleted: status === "completed",
    isFailed: status === "failed",
    isAborted: status === "aborted",
  };
}
