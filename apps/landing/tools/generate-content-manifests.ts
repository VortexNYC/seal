import fs from "node:fs/promises";
import path from "node:path";

import type { DocData } from "fumadocs-mdx/runtime/types";
import type { ReactNode } from "react";

import { changelog } from "../.source/server";
import type { ChangelogFeature } from "../src/lib/changelog/manifest";
import type { ContentImage } from "../src/lib/content/types";
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

interface ChangelogManifestEntry {
  breakingChanges: string[];
  coverImage?: ContentImage;
  features: ChangelogFeature[];
  fixes: string[];
  improvements: string[];
  path: string;
  releaseDate: string;
  slug: string;
  summary?: string;
  title: string;
  url: string;
  version: string;
}

interface ChangelogManifest {
  entries: ChangelogManifestEntry[];
  entriesBySlug: Record<string, ChangelogManifestEntry>;
}

type DocsPageData = DocData & {
  description?: string;
  lastModified?: Date;
  title: string;
};

type ChangelogDocData = DocData & {
  breakingChanges?: string[];
  coverImage?: ContentImage;
  description?: string;
  features?: ChangelogFeature[];
  fixes?: string[];
  improvements?: string[];
  releaseDate: string;
  summary?: string;
  title: string;
  version: string;
};

interface ChangelogCollectionEntry extends ChangelogDocData {
  path: string;
  slugs: string[];
  url: string;
}

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
const docsOutputPath = path.join(root, ".source", "docs-manifest.json");
const changelogOutputPath = path.join(root, ".source", "changelog-manifest.json");

async function generateDocsManifest(): Promise<void> {
  const pages: Record<string, DocsManifestPage> = {};

  for (const page of source.getPages()) {
    const data = page.data as DocsPageData;
    const key = page.slugs.join("/");
    const toc = data.toc.map((item) => ({
      depth: item.depth,
      title: serializeTocTitle(item.title),
      url: item.url,
    }));

    pages[key] = {
      description: data.description,
      lastModified: data.lastModified?.toISOString(),
      path: page.path,
      slugs: page.slugs,
      title: data.title,
      toc,
      url: page.url,
    };
  }

  const pageTree = await source.serializePageTree(source.pageTree);
  const manifest: DocsManifest = { pageTree, pages };

  await fs.mkdir(path.dirname(docsOutputPath), { recursive: true });
  await fs.writeFile(docsOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function generateChangelogManifest(): Promise<void> {
  const entries: ChangelogManifestEntry[] = [];

  for (const entry of changelog as unknown as ChangelogCollectionEntry[]) {
    const [slug] = entry.slugs;

    if (!slug) {
      throw new Error(`Missing changelog slug for ${entry.path}`);
    }

    entries.push({
      breakingChanges: entry.breakingChanges ?? [],
      coverImage: entry.coverImage,
      features: entry.features ?? [],
      fixes: entry.fixes ?? [],
      improvements: entry.improvements ?? [],
      path: entry.path,
      releaseDate: entry.releaseDate,
      slug,
      summary: entry.summary ?? entry.description,
      title: entry.title,
      url: entry.url,
      version: entry.version,
    });
  }

  entries.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));

  const manifest: ChangelogManifest = {
    entries,
    entriesBySlug: Object.fromEntries(entries.map((entry) => [entry.slug, entry])),
  };

  await fs.mkdir(path.dirname(changelogOutputPath), { recursive: true });
  await fs.writeFile(changelogOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await generateDocsManifest();
await generateChangelogManifest();
