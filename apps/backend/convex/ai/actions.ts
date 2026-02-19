import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { sealAgent } from "./agent";
import type { SealAICtx } from "./types";

/**
 * One-click document analysis: creates a thread (if needed),
 * sends the initial "Analyze this document" message, and returns
 * the threadId so the frontend can open the chat panel.
 *
 * This is the convenience wrapper that the "Analyze with AI" button calls.
 */
export const analyzeDocument = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
      documentId: args.documentId,
    });
    if (!document) throw new ConvexError("Document not found");

    const userId = identity.subject;

    // Check for existing thread
    const existingThread = await ctx.runQuery(internal.ai.threadQueries.getThreadByDocument, {
      documentId: args.documentId,
    });

    let threadId: string;

    if (existingThread) {
      threadId = existingThread.threadId;
    } else {
      // Create agent thread (action overload — returns { threadId, thread })
      const result = await sealAgent.createThread(
        ctx as unknown as SealAICtx,
        {
          userId,
          title: `Document: ${document.name ?? "Untitled"}`,
        },
      );
      threadId = result.threadId;

      // Save our mapping
      await ctx.runMutation(internal.ai.threads.saveThreadMapping, {
        threadId,
        documentId: args.documentId,
        organizationId: document.organizationId,
        userId,
      });
    }

    // Save the prompt and schedule generation
    const prompt = `Analyze the document with ID "${args.documentId}" and detect all form fields that should be placed on it. The document is named "${document.name}".`;

    const { messageId } = await sealAgent.saveMessage(
      ctx as unknown as SealAICtx,
      {
        threadId,
        userId,
        prompt,
        skipEmbeddings: true,
      },
    );

    // Schedule async generation
    await ctx.scheduler.runAfter(0, internal.ai.threads.generateResponseAsync, {
      threadId,
      promptMessageId: messageId,
      organizationId: document.organizationId,
      userId,
      documentId: args.documentId,
    });

    return { threadId };
  },
});
