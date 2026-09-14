import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/routes/**/*.{ts,tsx}"],
  project: ["src/**/*.{ts,tsx}"],
  ignore: [],
  ignoreDependencies: [
    // Tailwind CSS (used by Vite plugin)
    "tailwindcss",
    // TW Animate (imported in CSS)
    "tw-animate-css",
    // Radix UI (used by shadcn/ui components)
    "@radix-ui/*",
  ],
  ignoreBinaries: ["knip", "vp", "vortex-react-doctor"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
