// Seal MCP server knip configuration
import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["api/index.ts"],
  project: ["src/**/*.ts", "api/**/*.ts"],
  ignoreDependencies: [],
  ignoreBinaries: ["oxlint", "oxfmt", "knip"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
