import { useQuery } from "@tanstack/react-query";

import { getAIProgress } from "@/lib/api-client";

/**
 * Subscribes to AI progress for a given thread.
 * Returns step/tool tracking info and status.
 */
export function useAIProgress(threadId: string | null) {
  const { data: progress } = useQuery({
    queryKey: ["ai", "progress", threadId ?? "skip"],
    queryFn: async () => {
      if (threadId === null) {
        return null;
      }
      return getAIProgress(threadId);
    },
    enabled: threadId !== null,
    refetchInterval: 1000,
  });

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
