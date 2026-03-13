/**
 * AI Eval — DEV-only endpoint for promptfoo testing.
 *
 * Creates a fresh thread, sends a user message through the full AI pipeline
 * (system prompt + tools + Gemini Flash), and returns the assistant response.
 *
 * This runs the REAL pipeline: same system prompt, same tools, same model.
 * The only difference from production is that auth is bypassed (uses a
 * hardcoded test user/org) so promptfoo can call it headlessly.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { sealAgent, SYSTEM_INSTRUCTIONS } from "./agent";
import type { SealAICtx } from "./types";

type EvalResult = {
  response: string;
  toolCalls: string[];
  threadId: string;
  durationMs: number;
};

export const runEval = internalAction({
  args: {
    prompt: v.string(),
    documentId: v.optional(v.string()),
  },
  handler: async (ctx, { prompt, documentId }): Promise<EvalResult> => {
    const start = Date.now();

    // Look up a test organization — use the first org in the system
    const testOrg: { organizationId: string; userId: string } | null = await ctx.runQuery(
      internal.ai.eval_helpers.getTestOrganization,
    );
    if (!testOrg) {
      return {
        response: "[EVAL ERROR] No test organization found. Seed the dev database first.",
        toolCalls: [],
        threadId: "",
        durationMs: Date.now() - start,
      };
    }

    // 1. Create a fresh thread for this eval
    const thread: { threadId: string } = await sealAgent.createThread(ctx, {
      userId: testOrg.userId,
      title: `[eval] ${prompt.slice(0, 50)}`,
    });

    // 2. Save user message
    const msg: { messageId: string } = await sealAgent.saveMessage(ctx, {
      threadId: thread.threadId,
      prompt,
      skipEmbeddings: true,
    });

    // 3. Build system prompt with optional document context
    let systemPrompt = SYSTEM_INSTRUCTIONS;
    if (documentId) {
      systemPrompt += `\n\n## Current Document Context\nYou are currently viewing a document (ID: ${documentId}). When using tools that require a documentId parameter, use "${documentId}" unless the user explicitly asks about a different document.`;
    }

    // 4. Build the SealAICtx
    const sealCtx: SealAICtx = {
      ...ctx,
      organizationId: testOrg.organizationId as Id<"organizations">,
      userId: testOrg.userId,
      documentId: documentId as Id<"documents"> | undefined,
    } as SealAICtx;

    // 5. Run the FULL pipeline (system prompt + tools + model)
    const result: { text?: string; toolCalls?: { toolName: string }[] } =
      await sealAgent.generateText(
        sealCtx,
        { threadId: thread.threadId, userId: testOrg.userId },
        {
          promptMessageId: msg.messageId,
          system: systemPrompt,
        },
      );

    // 6. Extract response and tool usage
    const response: string = result.text ?? "[NO RESPONSE]";
    const toolCalls: string[] = (result.toolCalls ?? []).map((tc) => tc.toolName);

    return {
      response,
      toolCalls,
      threadId: thread.threadId,
      durationMs: Date.now() - start,
    };
  },
});
