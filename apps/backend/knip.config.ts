import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["convex/**/*.ts"],
  project: ["convex/**/*.ts"],
  ignoreDependencies: [
    // Clerk types (peer dependency)
    "@clerk/types",
    // PDF signing libraries (used in signing functionality)
    "@signpdf/placeholder-pdf-lib",
    "@signpdf/signpdf",
    "node-forge",
    // Triple-slash reference in test.setup.ts — provided by vitest
    "vite",
  ],
  ignoreBinaries: ["convex", "knip", "oxfmt", "oxlint"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
