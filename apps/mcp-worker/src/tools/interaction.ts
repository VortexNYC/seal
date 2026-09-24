/**
 * InteractionSession tools — URL + poll handoff (ADR-004 / SEA-61).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

const documentIdSchema = z.object({
  document_id: z.string().min(1).describe("Document ID to wait on"),
});

const waitSchema = z.object({
  document_id: z.string().min(1).describe("Document ID"),
  interval_ms: z
    .number()
    .min(250)
    .max(30_000)
    .optional()
    .describe("Poll interval in ms (default 2000)"),
  timeout_ms: z
    .number()
    .min(1000)
    .max(30 * 60 * 1000)
    .optional()
    .describe("Max wait in ms (default 900000 = 15 min)"),
});

type InteractionSession = {
  id: string;
  kind: string;
  url: string | null;
  status: string;
  message: string;
  poll?: { path: string; interval_ms: number };
  result?: unknown;
};

function createToolResponse(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function registerGetInteractionTool(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_get_interaction",
    "Get the InteractionSession for a document (Human handoff). Returns { id, kind, url, status, message, poll }. For signing: show or open `url` for the human, then call seal_wait_interaction (or poll seal_get_interaction) until status is not pending. Never forge the signature. Maps to MCP URL-mode elicitation.",
    documentIdSchema.shape,
    async (args, extra) => {
      const { document_id } = args as { document_id: string };
      const authToken = getAuthToken(extra);
      const session = await client.get<InteractionSession>(
        "/documents/interaction",
        { id: document_id },
        authToken
      );
      return createToolResponse(session);
    }
  );
}

function registerWaitInteractionTool(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_wait_interaction",
    "Poll InteractionSession until terminal (completed / cancelled / declined / expired). Prefer calling seal_get_interaction first and showing `url` + `message` to the human (or URL-mode elicitation). Returns the final session JSON.",
    waitSchema.shape,
    async (args, extra) => {
      const {
        document_id,
        interval_ms = 2000,
        timeout_ms = 15 * 60 * 1000,
      } = args as {
        document_id: string;
        interval_ms?: number;
        timeout_ms?: number;
      };
      const authToken = getAuthToken(extra);
      const started = Date.now();
      let last: InteractionSession | null = null;

      while (Date.now() - started < timeout_ms) {
        last = await client.get<InteractionSession>(
          "/documents/interaction",
          { id: document_id },
          authToken
        );
        if (last.status !== "pending") {
          return createToolResponse({
            ...last,
            waited_ms: Date.now() - started,
          });
        }
        await new Promise((r) => setTimeout(r, interval_ms));
      }

      return createToolResponse({
        error: "timeout",
        waited_ms: Date.now() - started,
        last,
      });
    }
  );
}

export function registerInteractionTools(
  server: McpServer,
  client: SealApiClient
): void {
  registerGetInteractionTool(server, client);
  registerWaitInteractionTool(server, client);
}
