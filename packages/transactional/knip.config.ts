import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/emails/**/*.tsx"],
  project: ["src/**/*.tsx"],
  ignoreDependencies: [
    // Design tokens (imported via @seal/tokens/theme subpath — knip can't trace workspace subpath exports)
    "@seal/tokens",
    // CLI-only package used by the local email preview/export scripts.
    "react-email",
  ],
  ignoreBinaries: ["email", "knip", "oxfmt", "oxlint", "tsc"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
