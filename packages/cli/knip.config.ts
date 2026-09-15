import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreBinaries: ["knip", "vp"],
  ignoreDependencies: ["@seal/tsconfig"],
};

export default config;
