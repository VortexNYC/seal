import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/routes/**/*.{ts,tsx}"],
  project: ["src/**/*.{ts,tsx}"],
  ignore: [
    // shadcn/ui components (often used but not directly imported)
    "src/components/ui/**",
  ],
  ignoreDependencies: [
    // Tailwind CSS (used by Vite plugin)
    "tailwindcss",
    // TW Animate (imported in CSS)
    "tw-animate-css",
    // Radix UI (used by shadcn/ui components)
    "@radix-ui/*",
  ],
  ignoreBinaries: ["knip", "oxfmt", "oxlint"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
