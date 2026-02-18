export const sanityConfig = {
  // Set these via environment variables or update after creating the Sanity project
  projectId: process.env.SANITY_PROJECT_ID || "rjlh373b",
  dataset: "production",
  apiVersion: "2024-01-01",
  useCdn: process.env.NODE_ENV === "production",
} as const;
