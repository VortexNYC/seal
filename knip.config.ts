import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    "apps/web": {
      entry: ["src/routes/**/*.{ts,tsx}"],
      project: ["src/**/*.{ts,tsx}"],
      ignoreDependencies: [
        // Tailwind CSS (used by Vite plugin)
        "tailwindcss",
        // TW Animate (imported in CSS)
        "tw-animate-css",
        // Radix UI (used by shadcn/ui components)
        "@radix-ui/*",
      ],
      ignoreBinaries: ["vortex-react-doctor"],
      ignoreExportsUsedInFile: true,
      ignoreIssues: { "**/*": ["duplicates"] },
    },
    "packages/sdk": {
      ignoreDependencies: ["@seal/tsconfig"],
      ignore: ["src/openapi.ts"],
      ignoreIssues: { "**/*": ["duplicates"] },
    },
    "packages/transactional": {
      entry: ["src/emails/**/*.tsx"],
      project: ["src/**/*.tsx"],
      ignoreDependencies: [
        // Design tokens (imported via @seal/tokens/theme subpath — knip can't trace workspace subpath exports)
        "@seal/tokens",
        // react-email's `email dev` CLI references its vendored preview server; not a real dependency of this package
        "@react-email/preview-server",
      ],
      ignoreExportsUsedInFile: true,
      ignoreIssues: { "**/*": ["duplicates"] },
    },
  },
};

export default config;
