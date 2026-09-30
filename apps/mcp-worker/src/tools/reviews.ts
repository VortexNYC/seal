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
