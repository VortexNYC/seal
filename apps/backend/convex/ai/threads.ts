import {
  abortStream,
  listStreams,
  listUIMessages,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";

import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction, internalMutation, internalQuery } from "../_generated/server";
import { authMutation, authQuery } from "../auth/wrappers";
import { sealAgent, sealAgentTier1, sealAgentTier3, SYSTEM_INSTRUCTIONS, classifyLocally, detectCascadeFailure } from "./agent";
import { aiRateLimiter } from "./rateLimiting";
import type { SealAICtx } from "./types";

/**
 * Build system prompt with optional document context so the LLM knows
 * which document it's currently viewing and can pass the correct ID to tools.
 */
function buildSystemPrompt(documentId?: string, documentName?: string): string {
  if (!documentId) return SYSTEM_INSTRUCTIONS;

  return `${SYSTEM_INSTRUCTIONS}

## Current Document Context
You are currently viewing the document "${documentName ?? "Untitled"}" (ID: ${documentId}).
When using tools that require a documentId parameter, use "${documentId}" unless the user explicitly asks about a different document.`;
}

type GenerateResponseArgs = {
  threadId: string;
  promptMessageId: string;
  prompt?: string;
  organizationId: Id<"organizations">;
  userId: string;
  documentId?: Id<"documents">;
  internalUserId?: Id<"users">;
};

async function getDocumentNameForPrompt(
  ctx: ActionCtx,
  documentId: GenerateResponseArgs["documentId"],
): Promise<string | undefined> {
  if (!documentId) {
    return undefined;
  }

  const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
    documentId,
  });

  return document?.name;
}

function createSealContext(ctx: ActionCtx, args: GenerateResponseArgs): SealAICtx {
  return {
    ...ctx,
    organizationId: args.organizationId,
    userId: args.userId,
    documentId: args.documentId,
  } as SealAICtx;
}

async function logChatUsage(
  ctx: ActionCtx,
  args: GenerateResponseArgs,
  totalTokens: number,
): Promise<void> {
  if (!args.internalUserId || totalTokens <= 0) {
    return;
  }

  try {
    await ctx.runMutation(internal.ai.usage.logAiUsage, {
      organizationId: args.organizationId,
      userId: args.internalUserId,
      action: "chat" as const,
      tokensUsed: totalTokens,
      durationMs: 0,
      documentId: args.documentId,
      modelUsed: "gemini-3-flash",
    });
  } catch (usageError) {
    console.error("[AI Chat] Failed to log usage:", usageError);
  }
}

/** Stream a response using the given agent (Tier 2 or Tier 3). */
async function streamWithAgent(
  agent: typeof sealAgent,
  ctx: ActionCtx,
  args: GenerateResponseArgs,
  sealCtx: SealAICtx,
  system: string,
): Promise<number> {
  let stepCount = 0;
  const completedTools: string[] = [];
  let totalTokens = 0;

  const result = await agent.streamText(
    sealCtx,
    {
      threadId: args.threadId,
      userId: args.userId,
    },
    {
      system,
      promptMessageId: args.promptMessageId,
      providerOptions: {
        google: { thinkingConfig: { thinkingLevel: "low" } },
      },
      onStepFinish: async (step) => {
        stepCount++;
        if (step.toolCalls) {
          for (const call of step.toolCalls) {
            completedTools.push(call.toolName);
          }
        }
        totalTokens += step.usage?.totalTokens ?? 0;

        await ctx.runMutation(internal.ai.progress.update, {
          threadId: args.threadId,
          step: stepCount,
          completedTools,
          tokensUsed: totalTokens,
        });
      },
    },
    {
      saveStreamDeltas: true,
    },
  );

  await result.text;
  const usage = await result.usage;
  totalTokens += usage?.totalTokens ?? 0;
  return totalTokens;
}

async function executeResponseGeneration(
  ctx: ActionCtx,
  args: GenerateResponseArgs,
  sealCtx: SealAICtx,
  documentName?: string,
): Promise<number> {
  const system = buildSystemPrompt(args.documentId, documentName);
  const tier = classifyLocally(args.prompt ?? "");
  console.info(`[SealAI] Route → ${tier}`);

  let totalTokens = 0;
  let tierUsed = 2;
  let wasFallback = false;

  if (tier === "TIER_3") {
    // Expert query → Pro model
    totalTokens = await streamWithAgent(sealAgentTier3, ctx, args, sealCtx, system);
    tierUsed = 3;
  } else if (tier === "TIER_2") {
    // Write intent → Flash (full tools)
    totalTokens = await streamWithAgent(sealAgent, ctx, args, sealCtx, system);
    tierUsed = 2;
  } else {
    // TIER_1: Flash-Lite with saveMessages: "none" + quality check
    let tier1Result: { text?: string; toolCalls?: { toolName: string }[] } | null = null;
    try {
      tier1Result = await sealAgentTier1.generateText(
        sealCtx,
        { threadId: args.threadId, userId: args.userId },
        // @ts-expect-error TS2345 deep type instantiation — saveMessages is valid at runtime
        { promptMessageId: args.promptMessageId, system, saveMessages: "none", providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } } },
      );
    } catch {
      console.warn("[SealAI] TIER_1 errored — falling back to TIER_2");
    }

    const failure = tier1Result ? detectCascadeFailure(tier1Result) : "error";
    if (!failure && tier1Result) {
      // Tier 1 passed quality check — save the response manually
      await sealAgent.saveMessage(sealCtx, {
        threadId: args.threadId,
        userId: args.userId,
        message: { role: "assistant", content: tier1Result.text ?? "" },
      });
      tierUsed = 1;
    } else {
      // Tier 1 failed — fall back to Tier 2 streaming
      console.warn(`[SealAI] TIER_1 failed (${failure}) — falling back to TIER_2`);
      totalTokens = await streamWithAgent(sealAgent, ctx, args, sealCtx, system);
      tierUsed = 2;
      wasFallback = true;
    }
  }

  await ctx.runMutation(internal.ai.progress.complete, {
    threadId: args.threadId,
    totalTokens,
  });

  await logChatUsage(ctx, args, totalTokens);

  // Log routing telemetry (non-critical)
  try {
    await ctx.runMutation(internal.ai.threads.logRouting, {
      threadId: args.threadId,
      tier: tierUsed,
      wasFallback,
    });
  } catch {
    // Don't let logging failure break the response
  }

  return totalTokens;
}

async function handleResponseGenerationError(
  ctx: ActionCtx,
  args: GenerateResponseArgs,
  sealCtx: SealAICtx,
  error: unknown,
): Promise<never> {
  const isAbort = error instanceof Error && error.name === "AbortError";
  const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

  if (isAbort) {
    await ctx.runMutation(internal.ai.progress.abort, {
      threadId: args.threadId,
      reason: "Stream aborted",
    });
    throw error;
  }

  try {
    await sealAgent.saveMessage(sealCtx, {
      threadId: args.threadId,
      userId: args.userId,
      message: {
        role: "assistant",
        content: `I encountered an error: ${errorMessage}. Please try again.`,
      },
      skipEmbeddings: true,
    });
  } catch {
    console.error("Failed to save error message to thread");
  }

  await ctx.runMutation(internal.ai.progress.fail, {
    threadId: args.threadId,
    error: errorMessage,
  });

  throw error;
}

// ---------------------------------------------------------------------------
// Thread CRUD
// ---------------------------------------------------------------------------

/**
 * Get or create a thread for a document.
 * Called from the frontend when the user opens the AI chat panel.
 */
export const getOrCreateThread = authMutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = ctx.auth.userId;
    if (!userId) throw new ConvexError("Not authenticated");

    // Check for existing thread for this document
    const existing = await ctx.db
      .query("ai_threads")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .first();

    if (existing) return { threadId: existing.threadId, isNew: false };

    // Get document to verify access and get org
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new ConvexError("Document not found");

    // Create agent thread (mutation overload — returns { threadId } only)
    const { threadId } = await sealAgent.createThread(ctx, {
      userId: userId.toString(),
      title: `Document: ${document.name ?? "Untitled"}`,
    });

    // Save our mapping
    await ctx.db.insert("ai_threads", {
      threadId,
      documentId: args.documentId,
      organizationId: document.organizationId,
      userId: userId.toString(),
      createdAt: Date.now(),
    });

    return { threadId, isNew: true };
  },
});

/**
 * Get or create a search thread (not tied to any document).
 * Called from the dedicated search page.
 */
export const getOrCreateSearchThread = authMutation({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth.userId;
    if (!userId) throw new ConvexError("Not authenticated");

    const organizationId = ctx.auth.organizationId;

    // Check for existing search thread for this user in this org
    const existing = await ctx.db
      .query("ai_threads")
      .withIndex("by_organization_user", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId.toString()),
      )
      .filter((q) => q.eq(q.field("threadType"), "search"))
      .first();

    if (existing) return { threadId: existing.threadId, isNew: false };

    // Create agent thread
    const { threadId } = await sealAgent.createThread(ctx, {
      userId: userId.toString(),
      title: "Document Search",
    });

    // Save our mapping (no documentId)
    await ctx.db.insert("ai_threads", {
      threadId,
      organizationId,
      userId: userId.toString(),
      threadType: "search",
      createdAt: Date.now(),
    });

    return { threadId, isNew: true };
  },
});

/**
 * Get existing thread for a document (read-only).
 */
export const getThreadForDocument = authQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ai_threads")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .first();
  },
});

// ---------------------------------------------------------------------------
// Send message (mutation → scheduler pattern)
// ---------------------------------------------------------------------------

/**
 * Save user message and schedule async generation.
 * Returns immediately so the UI gets instant feedback.
 */
export const sendMessage = authMutation({
  args: {
    threadId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.userId;
    if (!userId) throw new ConvexError("Not authenticated");

    // Rate limit checks (throws ConvexError if exceeded)
    await aiRateLimiter.limit(ctx, "sendMessage", {
      key: userId.toString(),
      throws: true,
    });
    await aiRateLimiter.limit(ctx, "orgSendMessage", {
      key: ctx.auth.organizationId.toString(),
      throws: true,
    });
    await aiRateLimiter.limit(ctx, "globalSendMessage", { throws: true });

    // Save the user message to the thread
    const { messageId } = await sealAgent.saveMessage(ctx, {
      threadId: args.threadId,
      userId: userId.toString(),
      prompt: args.prompt,
      skipEmbeddings: true,
    });

    // Look up the thread mapping for document context
    const threadMapping = await ctx.db
      .query("ai_threads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();
    if (!threadMapping) throw new ConvexError("Thread not found");

    // Schedule async generation — returns immediately
    await ctx.scheduler.runAfter(0, internal.ai.threads.generateResponseAsync, {
      threadId: args.threadId,
      promptMessageId: messageId,
      prompt: args.prompt,
      organizationId: threadMapping.organizationId,
      userId: userId.toString(),
      documentId: threadMapping.documentId,
      internalUserId: userId,
    });

    return { messageId, threadId: args.threadId };
  },
});

// ---------------------------------------------------------------------------
// Async generation (internalAction)
// ---------------------------------------------------------------------------

export const generateResponseAsync = internalAction({
  args: {
    threadId: v.string(),
    promptMessageId: v.string(),
    prompt: v.optional(v.string()),
    organizationId: v.id("organizations"),
    userId: v.string(),
    documentId: v.optional(v.id("documents")),
    internalUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.ai.progress.start, {
      threadId: args.threadId,
      totalSteps: 3,
    });

    const documentName = await getDocumentNameForPrompt(ctx, args.documentId);
    const sealCtx = createSealContext(ctx, args);

    try {
      await executeResponseGeneration(ctx, args, sealCtx, documentName);
    } catch (error) {
      await handleResponseGenerationError(ctx, args, sealCtx, error);
    }
  },
});

// ---------------------------------------------------------------------------
// List messages (query — enables useUIMessages on frontend)
// ---------------------------------------------------------------------------

export const listMessages = authQuery({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });

    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });

    return { ...paginated, streams };
  },
});

// ---------------------------------------------------------------------------
// Abort current stream
// ---------------------------------------------------------------------------

export const abortCurrentStream = authMutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const streams = await listStreams(ctx, components.agent, {
      threadId: args.threadId,
      includeStatuses: ["streaming"],
    });

    let abortedCount = 0;
    for (const stream of streams) {
      const aborted = await abortStream(ctx, components.agent, {
        streamId: stream.streamId,
        reason: "User cancelled",
      });
      if (aborted) abortedCount++;
    }

    if (abortedCount > 0) {
      await ctx.runMutation(internal.ai.progress.abort, {
        threadId: args.threadId,
        reason: "User cancelled",
      });
    }

    return { aborted: abortedCount > 0, abortedCount };
  },
});

// ---------------------------------------------------------------------------
// Retry message (regenerate from existing user message)
// ---------------------------------------------------------------------------

/**
 * Re-run generation from a specific user message without re-sending it.
 * Useful when the AI gave a poor response and the user wants to try again.
 */
export const retryMessage = authMutation({
  args: {
    threadId: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.userId;
    if (!userId) throw new ConvexError("Not authenticated");

    // Rate limit same as sendMessage
    await aiRateLimiter.limit(ctx, "sendMessage", {
      key: userId.toString(),
      throws: true,
    });

    // Verify thread ownership
    const threadMapping = await ctx.db
      .query("ai_threads")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();

    if (!threadMapping) throw new ConvexError("Thread not found");
    if (threadMapping.userId !== userId.toString()) {
      throw new ConvexError("Not authorized to retry in this thread");
    }

    // Schedule generation from the existing message
    await ctx.scheduler.runAfter(0, internal.ai.threads.generateResponseAsync, {
      threadId: args.threadId,
      promptMessageId: args.messageId,
      organizationId: threadMapping.organizationId,
      userId: userId.toString(),
      documentId: threadMapping.documentId,
      internalUserId: userId,
    });

    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// Internal helper: save thread mapping
// ---------------------------------------------------------------------------

export const saveThreadMapping = internalMutation({
  args: {
    threadId: v.string(),
    documentId: v.id("documents"),
    organizationId: v.id("organizations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("ai_threads", {
      threadId: args.threadId,
      documentId: args.documentId,
      organizationId: args.organizationId,
      userId: args.userId,
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Routing telemetry
// ---------------------------------------------------------------------------

export const logRouting = internalMutation({
  args: {
    threadId: v.string(),
    tier: v.number(),
    wasFallback: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("ai_routing_logs", {
      threadId: args.threadId,
      tier: args.tier,
      wasFallback: args.wasFallback,
      timestamp: Date.now(),
    });
  },
});

export const getRoutingDistribution = internalQuery({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db.query("ai_routing_logs").order("desc").take(1000);
    const tier1 = logs.filter((l) => l.tier === 1).length;
    const tier2Direct = logs.filter((l) => l.tier === 2 && !l.wasFallback).length;
    const tier2Fallback = logs.filter((l) => l.tier === 2 && l.wasFallback).length;
    const tier3 = logs.filter((l) => l.tier === 3).length;
    const tier1Total = tier1 + tier2Fallback;
    return {
      tier1Success: tier1,
      tier2Direct,
      tier2Fallback,
      tier3,
      total: logs.length,
      tier1SuccessRate: tier1Total > 0 ? Math.round((tier1 / tier1Total) * 100) : null,
    };
  },
});
