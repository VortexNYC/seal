import { type Root, visit } from "fumadocs-core/page-tree";
import { jsx } from "react/jsx-runtime";

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

function deserializeHtml(html: string) {
  return jsx("span", { dangerouslySetInnerHTML: { __html: html } });
}

function deserializePageTree(serialized: SerializedPageTree): Root {
  const root = serialized.data as Root;

  visit(root, (item) => {
    const mutableItem = item as { icon?: unknown; name?: unknown };

    if (typeof mutableItem.icon === "string") {
      mutableItem.icon = deserializeHtml(mutableItem.icon);
    }

    if (typeof mutableItem.name === "string") {
      mutableItem.name = deserializeHtml(mutableItem.name);
    }
  });

  return root;
}

const docsManifest = docsManifestData as unknown as DocsManifest;
const docsPageTree = deserializePageTree(docsManifest.pageTree) as Root;

export function getDocsPage(slugs: string[]): DocsManifestPage | undefined {
  return docsManifest.pages[slugs.join("/")];
}

export function getDocsPageTree(): Root {
  return docsPageTree;
}
