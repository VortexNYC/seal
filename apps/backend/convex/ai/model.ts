import { gateway } from "ai";

export function getModel(modelId = "google/gemini-3-flash") {
  return gateway(modelId);
}

export function getEmbeddingModel(modelId = "google/text-embedding-005") {
  return gateway.textEmbeddingModel(modelId);
}
