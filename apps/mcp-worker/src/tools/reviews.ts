/**
 * @fileoverview Review matrix tools (ADR-006 / SEA-80).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  type ApiReviewMatrix,
  type CreateReviewMatrixInput,
  createReviewMatrixSchema,
  type GenerateReviewMatrixInput,
  generateReviewMatrixSchema,
  type GetReviewMatrixInput,
  getReviewMatrixSchema,
} from "../api-contracts";
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

export function registerReviewTools(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_list_reviews",
    "List review matrices for the org — summary rows (id, title, model, status, counts).",
    {},
    async (_args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<unknown>("/reviews", {}, authToken);
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_create_review",
    "Create a legal review matrix over documents. Columns are extraction prompts; cells stay pending until generate.",
    createReviewMatrixSchema.shape,
    async (args, extra) => {
      const body = args as CreateReviewMatrixInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<ApiReviewMatrix>(
        "/reviews",
        body,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_get_review",
    "Get a review matrix by public ID, including rows and citation-grounded cells.",
    getReviewMatrixSchema.shape,
    async (args, extra) => {
      const { id } = args as GetReviewMatrixInput;
      const authToken = getAuthToken(extra);
      const response = await client.get<ApiReviewMatrix>(
        `/reviews/${encodeURIComponent(id)}`,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_generate_review",
    "Enqueue generation for pending/error cells — returns {job_id}; poll with seal_get_job or seal_get_review.",
    generateReviewMatrixSchema.shape,
    async (args, extra) => {
      const { id } = args as GenerateReviewMatrixInput;
      const authToken = getAuthToken(extra);
      const response = await client.post<{ job_id: string; status: string }>(
        `/reviews/${encodeURIComponent(id)}/generate`,
        {},
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_get_job",
    "Poll an async job (e.g. review generation) — returns status, error, and result payload.",
    {
      id: z.string().describe("Job public ID (job_…)"),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<unknown>(
        `/jobs/${encodeURIComponent(args.id)}`,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );
}

export function registerReviewPackTools(
  server: McpServer,
  client: SealApiClient
): void {
  server.tool(
    "seal_list_review_packs",
    "List review packs — builtin templates (NDA/MSA/employment) plus org-authored packs. Pass pack_id to seal_create_review to expand columns.",
    {},
    async (_args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.get<unknown>(
        "/review-packs",
        {},
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_create_review_pack",
    "Create an org-authored review pack — a named bundle of extraction columns (and optional default model) reusable across matrices.",
    {
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      model: z.string().max(120).optional(),
      columns: z
        .array(
          z.object({
            index: z.number().int().nonnegative(),
            name: z.string().min(1).max(120),
            prompt: z.string().min(1).max(4000),
          })
        )
        .min(1)
        .max(32),
    },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.post<unknown>(
        "/review-packs",
        args as Record<string, unknown>,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );

  server.tool(
    "seal_delete_review_pack",
    "Delete an org-authored review pack (builtin packs can't be deleted).",
    { id: z.string().describe("Pack public ID (pack_…)") },
    async (args, extra) => {
      const authToken = getAuthToken(extra);
      const response = await client.delete<unknown>(
        `/review-packs/${encodeURIComponent(args.id)}`,
        undefined,
        authToken
      );
      return createToolResponse(response);
    }
  );
}
