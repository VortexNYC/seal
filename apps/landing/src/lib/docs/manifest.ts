import type { Root } from "fumadocs-core/page-tree";
import { deserializePageTree } from "fumadocs-core/source/client";
<<<<<<< HEAD

=======
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
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

const docsManifest = docsManifestData as unknown as DocsManifest;
const docsPageTree = deserializePageTree(docsManifest.pageTree) as Root;

export function getDocsPage(slugs: string[]): DocsManifestPage | undefined {
  return docsManifest.pages[slugs.join("/")];
}

export function getDocsPageTree(): Root {
  return docsPageTree;
}
