import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["convex/**/*.ts"],
  project: ["convex/**/*.ts"],
  ignoreDependencies: [
    // PDF signing libraries (used in signing functionality)
    "@signpdf/placeholder-pdf-lib",
    "@signpdf/signpdf",
    "node-forge",
    // Triple-slash reference in test.setup.ts — provided by vitest
    "vite",
  ],
  ignoreBinaries: ["knip", "vp", "tsc"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
