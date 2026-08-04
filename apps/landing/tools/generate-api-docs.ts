import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Generates Fumadocs MDX pages from the OpenAPI spec.
 *
 * Output pages use `APIPage` from fumadocs-openapi and require React Server
 * Components to render. If integrating with a non-Next.js framework, use the
 * generated files for sidebar metadata only and render with a client-side
 * alternative (e.g. the /api-reference Scalar embed route).
 *
 * Run with: bun run docs:generate:api
 */
import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const specPath = path.join(root, "openapi.yaml");

// Use a stable key instead of the absolute path so generated MDX is portable
const input = createOpenAPI({
  input: () => ({ "seal-api": specPath }),
});

await generateFiles({
  input,
  output: path.join(root, "content/docs/api-reference"),
  groupBy: "tag",
  frontmatter: (title, description) => ({
    title,
    description,
  }),
});

console.info(
  "API docs generated. Note: generated pages require RSC to render."
);
console.info(
  "For interactive docs, the /api-reference Scalar route is used instead."
);
