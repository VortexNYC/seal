import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
  getOrCreateThread as getOrCreateThreadApi,
  getThreadForDocument,
} from "@/lib/api-client";

/**
 * Manages the AI chat thread for a document.
 * Creates or retrieves the thread when needed.
 */
export function useDocumentThread(documentPublicId: string) {
  const { data: existingThread } = useQuery({
    queryKey: ["documents", documentPublicId, "ai", "thread"],
    queryFn: () => getThreadForDocument(documentPublicId),
  });

  const getOrCreateThreadMutation = useMutation({
    mutationFn: () => getOrCreateThreadApi(documentPublicId),
  });
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Use the existing thread if available, or the one we just created
  const resolvedThreadId = threadId ?? existingThread?.threadId ?? null;

  const getOrCreateThread = useCallback(async () => {
    if (resolvedThreadId) return resolvedThreadId;

    setIsCreating(true);
    try {
      const result = await getOrCreateThreadMutation.mutateAsync();
      setThreadId(result.threadId);
      return result.threadId;
    } finally {
      setIsCreating(false);
    }
  }, [resolvedThreadId, getOrCreateThreadMutation]);

  return {
    threadId: resolvedThreadId,
    isReady: resolvedThreadId !== null,
    isCreating,
    getOrCreateThread,
  };
}
