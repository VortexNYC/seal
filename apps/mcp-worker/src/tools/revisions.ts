/**
 * @fileoverview Revision (redline) tools — propose/accept/reject anchored
 * text edits that materialize derived counter-proposal drafts on accept.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { SealApiClient } from "../client";
import { getAuthToken } from "../utils/auth";

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

const revisionSchema = {
  document_id: z.string().describe("Document public ID"),
  kind: z
    .enum(["insert", "delete", "replace"])
    .describe(
      "insert adds after the anchor; delete removes it; replace swaps it"
    ),
  anchor_quote: z
    .string()
    .describe("Verbatim excerpt from the document text the edit attaches to"),
  proposed_text: z
    .string()
    .optional()
    .describe(
      "Replacement (replace) or inserted text (insert). Not needed for delete."
    ),
  rationale: z.string().optional().describe("Why the change is proposed"),
  review_cell_id: z
    .string()
    .optional()
    .describe("Review cell ID if this came from a matrix"),
};

export function registerRevisionTools(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_propose_revision",
    "Propose a redline on a draft document — anchors a quote and proposes insert/delete/replace. Stays pending until accepted; the source doc is never mutated.",
    revisionSchema,
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/revisions",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_list_revisions",
    "List revision suggestions — filter by document_id and status (pending/accepted/rejected).",
    {
      document_id: z.string().optional().describe("Document public ID"),
      status: z.enum(["pending", "accepted", "rejected"]).optional(),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const params: Record<string, string> = {};
      if (args.document_id) params.document_id = args.document_id;
      if (args.status) params.status = args.status;
      const response = await client.get<unknown>(
        "/revisions",
        params,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_accept_revision",
    "Accept a pending revision — applies the text edit and creates a derived counter-proposal draft (new document, re-parsed). output=docx produces a Word tracked-changes file (w:ins/w:del) as the derived doc's original — the counterparty sees real redlines.",
    {
      id: z.string().describe("Revision public ID (rev_…)"),
      output: z
        .enum(["pdf", "docx"])
        .optional()
        .describe(
          "pdf = derived PDF from revised text (default); docx = Word tracked-changes round-trip file"
        ),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const path =
        `/revisions/${encodeURIComponent(args.id)}/accept` +
        (args.output === "docx" ? "?output=docx" : "");
      const response = await client.post<unknown>(
        path,
        {},
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_accept_all_revisions",
    "Accept every pending revision on a document in one shot — one derived draft (or one tracked-changes .docx with output=docx).",
    {
      document_id: z.string().describe("Document public ID"),
      output: z
        .enum(["pdf", "docx"])
        .optional()
        .describe("docx = Word tracked-changes artifact"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/revisions/accept-all",
        { document_id: args.document_id, output: args.output },
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_reject_revision",
    "Reject a pending revision — closes it without producing a document.",
    { id: z.string().describe("Revision public ID (rev_…)") },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        `/revisions/${encodeURIComponent(args.id)}/reject`,
        {},
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );
}
