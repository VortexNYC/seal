import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/emails/**/*.tsx"],
  project: ["src/**/*.tsx"],
  ignoreDependencies: [
    // React Email core dependencies (used at runtime)
    "react-email",
    // Design tokens (imported via @seal/tokens/theme subpath — knip can't trace workspace subpath exports)
    "@seal/tokens",
  ],
  ignoreBinaries: ["oxlint", "oxfmt", "knip", "email", "tsc"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
