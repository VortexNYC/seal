import { z } from "zod";

const postSchema = z.object({
  slug: z.string(),
  title: z.string(),
  date: z.string(),
  summary: z.string(),
  body: z.array(z.string()),
});

/**
 * Marketing changelog / posts — typed data layer (not EmDash CMS).
 * Edit this file; the `/changelog` page renders it. EmDash remains available
 * for future admin workflows but is not required for seal.nyc content.
 */
export const changelog = z
  .object({
    title: z.string(),
    description: z.string(),
    posts: z.array(postSchema).min(1),
  })
  .parse({
    title: "Changelog — Seal",
    description: "What shipped in Seal — agent-native signing on Cloudflare.",
    posts: [
      {
        slug: "v0-1-0",
        title: "v0.1.0 — OpenAPI-complete agent surface",
        date: "2026-09-22",
        summary:
          "First tagged release: full v1 OpenAPI for agents, MCP/CLI/SDK over the same API, internal routes isolated from the public host, hosted dogfood green.",
        body: [
          "Seal v0.1.0 is the floor for strangers and agents: clone, get an API key, upload → send → sign without knowing Vortex internals.",
          "OpenAPI now documents the live billing and usage summaries, office-format uploads (DOCX/XLSX/PPTX/CSV → PDF), and field `binding_key` for proposal↔document sync.",
          "Self-host path is `pnpm run selfhost` / `scripts/selfhost.sh` — Workers + D1 + R2, no Deploy-button theater.",
        ],
      },
      {
        slug: "signing-is-free",
        title: "Signing is free. The platform is the product.",
        date: "2026-09-15",
        summary:
          "Seal positions as contract infrastructure for code and agents — not another DocuSign clone with a fatter UI.",
        body: [
          "Agents drive via API, MCP, and SDK. Humans get a thin monitoring surface.",
          "Hosted at seal.nyc / app.seal.nyc / api.seal.nyc / docs.seal.nyc / mcp.seal.nyc.",
        ],
      },
    ],
  });
