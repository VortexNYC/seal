import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/emails/**/*.tsx"],
  project: ["src/**/*.tsx"],
  ignoreDependencies: [
    // Design tokens (imported via @seal/tokens/theme subpath — knip can't trace workspace subpath exports)
    "@seal/tokens",
  ],
  ignoreBinaries: ["knip", "oxfmt", "oxlint"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
