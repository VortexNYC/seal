import { AIChatAgent } from "@cloudflare/ai-chat";
import {
  streamText,
  tool,
  convertToModelMessages,
  stepCountIs,
  type GenerateTextOnFinishCallback,
} from "ai";
import { and, eq, like, or } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import { aiFieldSuggestions, documents, aiThreads } from "../global/schema.js";
import { getModelProvider, DEFAULT_CHAT_MODEL } from "../platform/ai.js";

interface SealChatState {
  documentId: string | null;
  documentPublicId: string | null;
  documentName: string | null;
  organizationId: string | null;
  userId: string | null;
  ready: boolean;
}

interface DocumentField {
  fieldType?: string;
  page?: number;
  [key: string]: unknown;
}

function cleanLikePattern(value: string): string {
  // Strip wildcard characters so the user's query is matched literally.
  return value.replace(/[%_]/g, "");
}

function safeJsonParse(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isDocumentFieldArray(value: unknown): value is DocumentField[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "object" && item !== null)
  );
}

function formatCitations(
  results: { publicId: string; name: string }[],
  page = 1
): string {
  return results
    .map((doc) => `<<cite:${doc.publicId}:${page}:${doc.name}>>`)
    .join("\n");
}

export class SealChatAgent extends AIChatAgent<Cloudflare.Env, SealChatState> {
  override initialState: SealChatState = {
    documentId: null,
    documentPublicId: null,
    documentName: null,
    organizationId: null,
    userId: null,
    ready: false,
  };

  override async onStart(): Promise<void> {
    if (this.state.ready) {
      return;
    }

    const db = createD1(this.env.D1);
    const threadRows = await db
      .select({
        documentId: aiThreads.documentId,
        organizationId: aiThreads.organizationId,
        userId: aiThreads.userId,
      })
      .from(aiThreads)
      .where(eq(aiThreads.threadId, this.name))
      .limit(1);

    const thread = threadRows[0];
    if (!thread || !thread.documentId) {
      this.setState({ ...this.initialState, ready: true });
      return;
    }

    const documentRows = await db
      .select({ publicId: documents.publicId, name: documents.name })
      .from(documents)
      .where(eq(documents.id, thread.documentId))
      .limit(1);

    this.setState({
      documentId: thread.documentId,
      documentPublicId: documentRows[0]?.publicId ?? null,
      documentName: documentRows[0]?.name ?? null,
      organizationId: thread.organizationId,
      userId: thread.userId,
      ready: true,
    });
  }

  private getSystemPrompt(): string {
    const ctx = this.state;
    const documentContext = ctx.documentName
      ? `The current document is "${ctx.documentName}" (id ${ctx.documentPublicId ?? "unknown"}).` +
        " Use the available tools to analyze it, search across the workspace, or extract payment terms."
      : "No specific document is attached to this thread.";

    return [
      "You are Seal AI, a document-signing assistant for Seal by Vortex.",
      documentContext,
      "When referencing documents, always use the citation format <<cite:publicId:pageNumber:documentName>>.",
      "Be concise, cite sources, and only call tools that are relevant to the user's request.",
    ].join("\n\n");
  }

  private getTools() {
    return {
      searchDocuments: tool({
        description:
          "Search the workspace for documents by name or description.",
        inputSchema: z.object({
          query: z.string().describe("Free-text search query"),
        }),
        execute: async ({ query }): Promise<string> => {
          const ctx = this.state;
          if (!ctx.organizationId) {
            return "Workspace context is not loaded yet. Please try again.";
          }

          const db = createD1(this.env.D1);
          const searchValue = cleanLikePattern(query.trim());
          if (!searchValue) {
            return "Please provide a non-empty search term.";
          }

          const results = await db
            .select({
              publicId: documents.publicId,
              name: documents.name,
            })
            .from(documents)
            .where(
              and(
                eq(documents.organizationId, ctx.organizationId),
                or(
                  like(documents.name, `%${searchValue}%`),
                  like(documents.description, `%${searchValue}%`)
                )
              )
            )
            .limit(10);

          if (results.length === 0) {
            return `No documents matched "${query}".`;
          }

          return (
            `Found ${results.length} document(s) matching "${query}":\n\n` +
            formatCitations(results, 1)
          );
        },
      }),

      getDocumentFields: tool({
        description:
          "Return the AI-suggested form fields for the current document.",
        inputSchema: z.object({}),
        execute: async (): Promise<string> => {
          const ctx = this.state;
          if (!ctx.documentId || !ctx.organizationId) {
            return "No document context is available for this thread.";
          }

          const db = createD1(this.env.D1);
          const rows = await db
            .select({
              fields: aiFieldSuggestions.fields,
              paymentExtraction: aiFieldSuggestions.paymentExtraction,
              status: aiFieldSuggestions.status,
            })
            .from(aiFieldSuggestions)
            .where(
              and(
                eq(aiFieldSuggestions.documentId, ctx.documentId),
                eq(aiFieldSuggestions.organizationId, ctx.organizationId)
              )
            )
            .orderBy(aiFieldSuggestions.createdAt)
            .limit(1);

          const latest = rows[0];
          if (!latest) {
            return "No field suggestions have been generated for this document yet.";
          }

          const parsedFields = safeJsonParse(latest.fields);
          if (
            !isDocumentFieldArray(parsedFields) ||
            parsedFields.length === 0
          ) {
            return `Latest suggestion status is ${latest.status ?? "unknown"}, but no fields were returned.`;
          }

          const summary = parsedFields
            .map((field, index) => {
              const page =
                typeof field.page === "number" ? ` (page ${field.page})` : "";
              const type =
                typeof field.fieldType === "string"
                  ? ` [${field.fieldType}]`
                  : "";
              return `${index + 1}. ${type}${page}`;
            })
            .join("\n");

          const paymentNote = latest.paymentExtraction
            ? `\n\nPayment extraction:\n${latest.paymentExtraction}`
            : "";

          return `Found ${parsedFields.length} suggested field(s) for "${ctx.documentName ?? "this document"}":\n\n${summary}${paymentNote}`;
        },
      }),

      extractPaymentTerms: tool({
        description:
          "Extract payment terms and payment-linked fields for the current document.",
        inputSchema: z.object({}),
        execute: async (): Promise<string> => {
          const ctx = this.state;
          if (!ctx.documentId || !ctx.organizationId) {
            return "No document context is available for this thread.";
          }

          const db = createD1(this.env.D1);
          const rows = await db
            .select({
              fields: aiFieldSuggestions.fields,
              paymentExtraction: aiFieldSuggestions.paymentExtraction,
            })
            .from(aiFieldSuggestions)
            .where(
              and(
                eq(aiFieldSuggestions.documentId, ctx.documentId),
                eq(aiFieldSuggestions.organizationId, ctx.organizationId)
              )
            )
            .orderBy(aiFieldSuggestions.createdAt)
            .limit(1);

          const latest = rows[0];
          if (!latest) {
            return "No payment data has been extracted for this document yet.";
          }

          if (latest.paymentExtraction) {
            return `Payment terms for "${ctx.documentName ?? "this document"}":\n\n${latest.paymentExtraction}`;
          }

          const parsedFields = safeJsonParse(latest.fields);
          const paymentFields = isDocumentFieldArray(parsedFields)
            ? parsedFields.filter((field) => field.fieldType === "payment")
            : [];

          if (paymentFields.length === 0) {
            return `No payment-specific fields were found for "${ctx.documentName ?? "this document"}".`;
          }

          const summary = paymentFields
            .map((field, index) => {
              const page =
                typeof field.page === "number" ? ` (page ${field.page})` : "";
              return `${index + 1}. ${JSON.stringify(field)}${page}`;
            })
            .join("\n");

          return `Found ${paymentFields.length} payment field(s):\n\n${summary}`;
        },
      }),
    };
  }

  override async onChatMessage(
    onFinish: GenerateTextOnFinishCallback
  ): Promise<Response | undefined> {
    const modelProvider = getModelProvider(this.env);
    const result = streamText({
      model: modelProvider(DEFAULT_CHAT_MODEL),
      system: this.getSystemPrompt(),
      messages: await convertToModelMessages(this.messages),
      tools: this.getTools(),
      stopWhen: stepCountIs(5),
      onFinish,
    });

    return result.toUIMessageStreamResponse();
  }
}
