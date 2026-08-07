import type { Root } from "fumadocs-core/page-tree";
import { deserializePageTree } from "fumadocs-core/source/client";
import { z } from "zod";

import developerManifestData from "../../../.source/developer-manifest.json";
import docsManifestData from "../../../.source/docs-manifest.json";

const serializedPageTreeSchema = z.object({
  $fumadocs_loader: z.literal("page-tree"),
  data: z.record(z.string(), z.unknown()),
});

const docsManifestPageSchema = z.object({
  description: z.string().optional(),
  lastModified: z.string().optional(),
  path: z.string(),
  slugs: z.array(z.string()),
  title: z.string(),
  toc: z.array(
    z.object({
      depth: z.number(),
      title: z.string(),
      url: z.string(),
    })
  ),
  url: z.string(),
});

const docsManifestSchema = z.object({
  pageTree: serializedPageTreeSchema,
  pages: z.record(z.string(), docsManifestPageSchema),
});

export type DocsManifestPage = z.infer<typeof docsManifestPageSchema>;

// Docs
const docsManifest = docsManifestSchema.parse(docsManifestData);
const docsPageTree = deserializePageTree(docsManifest.pageTree);

export function getDocsPage(slugs: string[]): DocsManifestPage | undefined {
  return docsManifest.pages[slugs.join("/")];
}

export function getDocsPageTree(): Root {
  return docsPageTree;
}

// Developer
const developerManifest = docsManifestSchema.parse(developerManifestData);
const developerPageTree = deserializePageTree(developerManifest.pageTree);

export function getDeveloperPage(
  slugs: string[]
): DocsManifestPage | undefined {
  return developerManifest.pages[slugs.join("/")];
}

export function getDeveloperPageTree(): Root {
  return developerPageTree;
}
