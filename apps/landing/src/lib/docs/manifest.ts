import type { Root } from "fumadocs-core/page-tree";
import { deserializePageTree } from "fumadocs-core/source/client";

import developerManifestData from "../../../.source/developer-manifest.json";
import docsManifestData from "../../../.source/docs-manifest.json";

interface SerializedPageTree {
  $fumadocs_loader: "page-tree";
  data: object;
}

export interface DocsManifestPage {
  description?: string;
  lastModified?: string;
  path: string;
  slugs: string[];
  title: string;
  toc: Array<{
    depth: number;
    title: string;
    url: string;
  }>;
  url: string;
}

interface DocsManifest {
  pageTree: SerializedPageTree;
  pages: Record<string, DocsManifestPage>;
}

// Docs
const docsManifest = docsManifestData as unknown as DocsManifest;
const docsPageTree = deserializePageTree(docsManifest.pageTree) as Root;

export function getDocsPage(slugs: string[]): DocsManifestPage | undefined {
  return docsManifest.pages[slugs.join("/")];
}

export function getDocsPageTree(): Root {
  return docsPageTree;
}

// Developer
const developerManifest = developerManifestData as unknown as DocsManifest;
const developerPageTree = deserializePageTree(
  developerManifest.pageTree
) as Root;

export function getDeveloperPage(
  slugs: string[]
): DocsManifestPage | undefined {
  return developerManifest.pages[slugs.join("/")];
}

export function getDeveloperPageTree(): Root {
  return developerPageTree;
}
