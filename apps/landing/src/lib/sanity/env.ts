import { apiVersion, dataset, projectId } from "@seal/sanity-config";

export const sanityConfig = {
  projectId,
  dataset,
  apiVersion,
  useCdn: process.env.NODE_ENV === "production",
} as const;
