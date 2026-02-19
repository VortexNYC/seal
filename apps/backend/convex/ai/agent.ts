import { Agent } from "@convex-dev/agent";

import { components } from "../_generated/api";
import { getEmbeddingModel, getModel } from "./model";
import { analyzeDocumentFields } from "./tools/analyze_fields";
import type { SealAICtx } from "./types";

const SYSTEM_INSTRUCTIONS = `You are Seal AI, a document intelligence assistant for the Seal document signing platform.

You analyze PDF documents to identify where signature fields, text fields, date fields, and other form fields should be placed. You provide precise coordinates and labels for each detected field.

When analyzing a document, call the analyzeDocumentFields tool with the document ID. The tool will handle downloading the PDF, analyzing it with vision AI, and storing the field suggestions.`;

export const sealAgent = new Agent<SealAICtx>(components.agent, {
  name: "Seal AI",
  languageModel: getModel("google/gemini-3-flash"),
  textEmbeddingModel: getEmbeddingModel("google/text-embedding-004"),
  instructions: SYSTEM_INSTRUCTIONS,
  tools: { analyzeDocumentFields },
  maxSteps: 3,

  // Keep tool call/result messages out of the prompt context for cleaner responses
  contextOptions: {
    excludeToolMessages: true,
    recentMessages: 50,
  },
});
