import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/routes/**/*.{ts,tsx}"],
  project: ["src/**/*.{ts,tsx}"],
  ignore: [
    // shadcn/ui components (often used but not directly imported)
    "src/components/ui/**",
    "playwright.config.ts",
  ],
  ignoreDependencies: [
    // Tailwind CSS (used by Vite plugin)
    "tailwindcss",
    // TW Animate (imported in CSS)
    "tw-animate-css",
    // Radix UI (used by shadcn/ui components)
    "@radix-ui/*",
    // Design tokens (imported via @seal/tokens/theme subpath — knip can't trace workspace subpath exports)
    "@seal/tokens",
    // E2E-only dependency used in Playwright auth fixtures outside src/**
    "@clerk/testing",
  ],
  ignoreBinaries: ["oxlint", "oxfmt", "knip"],
  ignoreExportsUsedInFile: true,
  exclude: ["duplicates"],
};

export default config;
