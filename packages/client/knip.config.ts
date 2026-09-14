import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreBinaries: ["knip", "vp"],
  ignoreDependencies: ["@seal/tsconfig"],
  ignore: ["src/openapi.ts"],
};

export default config;
