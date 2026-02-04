import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/emails/**/*.tsx"],
  project: ["src/**/*.tsx"],
  ignore: [
    // React Email generated files
    ".react-email/**",
  ],
  ignoreDependencies: [
    // React Email core dependencies (used at runtime)
    "react",
    "react-email",
    // React types (used by TSX files)
    "@types/react",
  ],
  ignoreBinaries: ["oxlint", "oxfmt", "knip", "email", "tsc"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
