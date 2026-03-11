import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreBinaries: ["oxlint", "oxfmt", "knip"],
  exclude: ["duplicates"],
};

export default config;
