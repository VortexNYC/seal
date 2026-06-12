/**
 * AI Eval — DEV-only endpoint for promptfoo testing.
 *
 * Creates a fresh thread, sends one or more user messages through the full AI
 * pipeline (system prompt + tools + routing), and returns the final assistant
 * response. Multi-turn evals send each message in sequence on the same thread.
 *
 * This runs the REAL pipeline: same system prompt, same tools, same routing.
 * The only difference from production is that auth is bypassed (uses a
 * hardcoded test user/org) so promptfoo can call it headlessly.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internalAction, internalMutation } from "../_generated/server";
import {
  sealAgent,
  sealAgentTier1,
  sealAgentTier3,
  SYSTEM_INSTRUCTIONS,
  classifyLocally,
  detectCascadeFailure,
} from "./agent";
import type { SealAICtx } from "./types";

type EvalResult = {
  response: string;
  toolCalls: string[];
  tierUsed: number;
  threadId: string;
  durationMs: number;
};

type ExecResult = { text?: string; toolCalls?: { toolName: string }[] };

const tier1Opts = { providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } } };

/** Process a single message through the tiered routing pipeline. */
async function processEvalMessage(
  ctx: ActionCtx,
  sealCtx: SealAICtx,
  threadId: string,
  messageId: string,
  prompt: string,
  systemPrompt: string,
): Promise<{ result: ExecResult; tierUsed: number }> {
  const tier = classifyLocally(prompt);
  console.info(`[SealAI eval] Route → ${tier} for: "${prompt.slice(0, 60)}"`);

  if (tier === "TIER_3") {
    const { thread } = await sealAgentTier3.continueThread(sealCtx, { threadId });
    const result = await thread.generateText(
      { promptMessageId: messageId, system: systemPrompt },
      { storageOptions: { saveMessages: "all" } },
    );
    return { result, tierUsed: 3 };
  }

  if (tier === "TIER_2") {
    const { thread } = await sealAgent.continueThread(sealCtx, { threadId });
    const result = await thread.generateText(
      { promptMessageId: messageId, system: systemPrompt },
      { storageOptions: { saveMessages: "all" } },
    );
    return { result, tierUsed: 2 };
  }

  // TIER_1: Flash-Lite with quality check + fallback
  let tier1: ExecResult | null = null;
  try {
    const { thread } = await sealAgentTier1.continueThread(sealCtx, { threadId });
    tier1 = await thread.generateText(
      { promptMessageId: messageId, system: systemPrompt, ...tier1Opts },
      { storageOptions: { saveMessages: "none" } },
    );
  } catch {
    console.warn("[SealAI eval] TIER_1 errored — falling back to TIER_2");
  }

  const failure = tier1 ? detectCascadeFailure(tier1) : "error";
  if (!failure && tier1) {
    await sealAgent.saveMessage(ctx, {
      threadId,
      message: { role: "assistant", content: tier1.text ?? "" },
    });
    return { result: tier1, tierUsed: 1 };
  }

  console.warn(`[SealAI eval] TIER_1 failed (${failure}) — falling back to TIER_2`);
  const { thread } = await sealAgent.continueThread(sealCtx, { threadId });
  const result = await thread.generateText(
    { promptMessageId: messageId, system: systemPrompt },
    { storageOptions: { saveMessages: "all" } },
  );
  return { result, tierUsed: 2 };
}

export const runEval = internalAction({
  args: {
    messages: v.array(v.string()),
    documentId: v.optional(v.string()),
  },
  handler: async (ctx, { messages, documentId }): Promise<EvalResult> => {
    const start = Date.now();

    const testOrg: { organizationId: string; userId: string } | null = await ctx.runQuery(
      internal.ai.eval_helpers.getTestOrganization,
    );
    if (!testOrg) {
      return {
        response: "[EVAL ERROR] No test organization found. Seed the dev database first.",
        toolCalls: [],
        tierUsed: 0,
        threadId: "",
        durationMs: Date.now() - start,
      };
    }

    const thread: { threadId: string } = await sealAgent.createThread(ctx, {
      userId: testOrg.userId,
      title: `[eval] ${(messages[0] ?? "").slice(0, 50)}`,
    });

    let systemPrompt = SYSTEM_INSTRUCTIONS;
    if (documentId) {
      systemPrompt += `\n\n## Current Document Context\nYou are currently viewing a document (ID: ${documentId}). When using tools that require a documentId parameter, use "${documentId}" unless the user explicitly asks about a different document.`;
    }

    const sealCtx: SealAICtx = {
      ...ctx,
      organizationId: testOrg.organizationId as Id<"organizations">,
      userId: testOrg.userId,
      documentId: documentId as Id<"documents"> | undefined,
    } as SealAICtx;

    let result: ExecResult = {};
    let tierUsed = 1;

    for (const prompt of messages) {
      const { messageId } = await sealAgent.saveMessage(ctx, {
        threadId: thread.threadId,
        prompt,
        skipEmbeddings: true,
      });

      const step = await processEvalMessage(
        ctx,
        sealCtx,
        thread.threadId,
        messageId,
        prompt,
        systemPrompt,
      );
      result = step.result;
      tierUsed = step.tierUsed;
    }

    return {
      response: result.text ?? "[NO RESPONSE]",
      toolCalls: (result.toolCalls ?? []).map((tc) => tc.toolName),
      tierUsed,
      threadId: thread.threadId,
      durationMs: Date.now() - start,
    };
  },
});

// ── Eval state reset ────────────────────────────────────────────────────────
// Cleans up artifacts from prior eval runs to prevent contamination.
// Deletes eval threads (title starts with "[eval]") and recent routing logs.

export const resetEvalState = internalMutation({
  args: {},
  handler: async (ctx) => {
    let deleted = 0;

    const threads = await ctx.db.query("ai_threads").take(500);
    for (const t of threads) {
      if (t.threadId && t.threadId.startsWith?.("[eval]")) {
        await ctx.db.delete(t._id);
        deleted++;
      }
    }

    const logs = await ctx.db.query("ai_routing_logs").order("desc").take(500);
    for (const log of logs) {
      await ctx.db.delete(log._id);
      deleted++;
    }

    console.info(`[SealAI eval] Reset complete — deleted ${deleted} artifacts`);
    return { deleted };
  },
});
