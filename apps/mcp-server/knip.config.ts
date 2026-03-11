import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["api/index.ts"],
  project: ["src/**/*.ts", "api/**/*.ts"],
  ignoreDependencies: [
    // Workspace subpath imports from @seal/backend are used for shared API validation schemas.
    "@seal/backend",
  ],
  ignoreBinaries: ["oxlint", "oxfmt", "knip"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
