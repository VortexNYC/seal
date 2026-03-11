import fs from "node:fs/promises";
import path from "node:path";

import type { DocData } from "fumadocs-mdx/runtime/types";
import type { ReactNode } from "react";

import { source } from "../src/lib/docs/server-source";

interface SerializedTocItem {
  depth: number;
  title: string;
  url: string;
}

interface DocsManifestPage {
  description?: string;
  lastModified?: string;
  path: string;
  slugs: string[];
  title: string;
  toc: SerializedTocItem[];
  url: string;
}

interface DocsManifest {
  pageTree: Awaited<ReturnType<typeof source.serializePageTree>>;
  pages: Record<string, DocsManifestPage>;
}

type DocsPageData = DocData & {
  description?: string;
  lastModified?: Date;
  title: string;
};

function serializeTocTitle(title: ReactNode): string {
  if (typeof title === "string" || typeof title === "number") {
    return String(title);
  }

  if (Array.isArray(title)) {
    return title.map(serializeTocTitle).join("");
  }

  if (title && typeof title === "object" && "props" in title) {
    const element = title as { props?: { children?: ReactNode } };
    return serializeTocTitle(element.props?.children ?? "");
  }

  return "";
}

const root = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(root, ".source", "docs-manifest.json");

async function generateDocsManifest(): Promise<void> {
  const pages = Object.fromEntries(
    source.getPages().map((page) => {
      const data = page.data as DocsPageData;
      const key = page.slugs.join("/");

      return [
        key,
        {
          description: data.description,
          lastModified: data.lastModified?.toISOString(),
          path: page.path,
          slugs: page.slugs,
          title: data.title,
          toc: data.toc.map((item) => ({
            depth: item.depth,
            title: serializeTocTitle(item.title),
            url: item.url,
          })),
          url: page.url,
        } satisfies DocsManifestPage,
      ];
    }),
  );

  const manifest: DocsManifest = {
    pageTree: await source.serializePageTree(source.pageTree),
    pages,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await generateDocsManifest();
