import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/emails/**/*.tsx"],
  project: ["src/**/*.tsx"],
  ignoreDependencies: [
    // Design tokens (imported via @seal/tokens/theme subpath — knip can't trace workspace subpath exports)
    "@seal/tokens",
    // react-email's `email dev` CLI references its vendored preview server; not a real dependency of this package
    "@react-email/preview-server",
  ],
  ignoreBinaries: ["knip", "vp"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
