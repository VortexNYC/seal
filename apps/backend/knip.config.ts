import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["convex/**/*.ts"],
  project: ["convex/**/*.ts"],
  ignoreDependencies: [
    // Workspace dependencies
    "@seal/transactional",
    // Clerk types (peer dependency)
    "@clerk/types",
    // PDF signing libraries (used in signing functionality)
    "@signpdf/placeholder-pdf-lib",
    "@signpdf/signpdf",
    "node-forge",
  ],
  ignoreBinaries: ["oxlint", "oxfmt", "knip"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
