import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

/**
 * Manages the AI chat thread for a document.
 * Creates or retrieves the thread when needed.
 */
export function useDocumentThread(documentId: Id<"documents">) {
  const existingThread = useQuery(api.ai.threads.getThreadForDocument, {
    documentId,
  });

  const getOrCreateThreadMutation = useMutation(api.ai.threads.getOrCreateThread);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Use the existing thread if available, or the one we just created
  const resolvedThreadId = threadId ?? existingThread?.threadId ?? null;

  const getOrCreateThread = useCallback(async () => {
    if (resolvedThreadId) return resolvedThreadId;

    setIsCreating(true);
    try {
      const result = await getOrCreateThreadMutation({ documentId });
      setThreadId(result.threadId);
      return result.threadId;
    } finally {
      setIsCreating(false);
    }
  }, [resolvedThreadId, getOrCreateThreadMutation, documentId]);

  return {
    threadId: resolvedThreadId,
    isReady: resolvedThreadId !== null,
    isCreating,
    getOrCreateThread,
  };
}
