/// <reference types="node" />

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { getChangelogEntries } from "../src/lib/changelog/manifest";
import { getAllPageSlugs } from "../src/lib/content/pages";
import { source } from "../src/lib/docs/server-source";

const SITE_URL = "https://seal.nyc";
const OUTPUT_FILE = path.resolve("public", "sitemap.xml");

async function generateSitemap(): Promise<void> {
  const today = new Date().toISOString().split("T")[0] as string;
  const docsPages = source.getPages();
  const landingPages = getAllPageSlugs();
  const changelogEntries = getChangelogEntries();

  const urls: Array<{
    path: string;
    lastmod: string;
    changefreq: string;
    priority: string;
  }> = [];

  urls.push({
    path: "/",
    lastmod: today,
    changefreq: "weekly",
    priority: "1.0",
  });
  urls.push({
    path: "/changelog",
    lastmod: today,
    changefreq: "weekly",
    priority: "0.7",
  });

  for (const page of landingPages) {
    urls.push({
      path: `/pages/${page.slug}`,
      lastmod: page.updatedAt ?? today,
      changefreq: "monthly",
      priority: "0.6",
    });
  }

  for (const entry of changelogEntries) {
    urls.push({
      path: `/changelog/${entry.slug}`,
      lastmod: entry.releaseDate || today,
      changefreq: "monthly",
      priority: "0.5",
    });
  }

  for (const page of docsPages) {
    urls.push({
      path: page.url,
      lastmod: today,
      changefreq: "weekly",
      priority: "0.8",
    });
  }

  const urlEntries = urls
    .map(
      (u) => `  <url>
    <loc>${SITE_URL}${u.path}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

  await writeFile(OUTPUT_FILE, xml);
  console.info(`[sitemap] Generated ${urls.length} URLs → ${OUTPUT_FILE}`);
}

generateSitemap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[sitemap] Failed to generate sitemap:", message);
  process.exitCode = 1;
});
