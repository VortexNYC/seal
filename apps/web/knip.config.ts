import type { KnipConfig } from "knip";

const config: KnipConfig = {
	entry: ["src/main.tsx", "src/routes/**/*.{ts,tsx}"],
	project: ["src/**/*.{ts,tsx}"],
	ignore: [
		// TanStack Router generated file
		"src/routeTree.gen.ts",
		"**/routeTree.gen.ts",
		// shadcn/ui components (often used but not directly imported)
		"src/components/ui/**",
		// Test files
		"e2e/**",
		"**/*.test.{ts,tsx}",
		"**/*.spec.{ts,tsx}",
		"playwright.config.ts",
		"playwright-report/**",
		"test-results/**",
		// Build outputs
		"dist/**",
		".cache/**",
	],
	ignoreDependencies: [
		// Tailwind CSS (used by Vite plugin)
		"tailwindcss",
		// TW Animate (imported in CSS)
		"tw-animate-css",
		// Radix UI (used by shadcn/ui components)
		"@radix-ui/*",
	],
	ignoreBinaries: ["biome", "knip", "vite", "tsc", "playwright"],
	ignoreExportsUsedInFile: true,
	exclude: ["duplicates"],
};

export default config;
