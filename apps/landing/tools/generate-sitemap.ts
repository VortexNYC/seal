/// <reference types="node" />

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@sanity/client";
import { createServer } from "vite";

const SITE_URL = "https://seal.nyc";
const OUTPUT_FILE = path.resolve("public", "sitemap.xml");

const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID || "rjlh373b",
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: "2024-01-01",
  useCdn: false,
});

async function generateSitemap(): Promise<void> {
  const today = new Date().toISOString().split("T")[0] as string;

  // Load fumadocs source via Vite SSR to get docs pages
  const server = await createServer({
    configFile: path.resolve("vite.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  let docsPages: Array<{ url: string }> = [];
  try {
    const { source } = await server.ssrLoadModule("/src/lib/source.ts");
    docsPages = source.getPages();
  } finally {
    await server.close();
  }

  // Fetch Sanity content in parallel
  const [sanityPages, changelogEntries] = await Promise.all([
    sanity
      .fetch<Array<{ slug: string; _updatedAt: string }>>(
        `*[_type == "page" && defined(slug.current)] { "slug": slug.current, _updatedAt }`,
      )
      .catch(() => []),
    sanity
      .fetch<Array<{ slug: { current: string }; releaseDate: string }>>(
        `*[_type == "changelog"] | order(releaseDate desc) { slug, releaseDate }`,
      )
      .catch(() => []),
  ]);

  const urls: Array<{ path: string; lastmod: string; changefreq: string; priority: string }> = [];

  // Static routes
  urls.push({ path: "/", lastmod: today, changefreq: "weekly", priority: "1.0" });
  urls.push({ path: "/changelog", lastmod: today, changefreq: "weekly", priority: "0.7" });

  // Sanity CMS pages
  for (const page of sanityPages) {
    urls.push({
      path: `/pages/${page.slug}`,
      lastmod: page._updatedAt?.split("T")[0] ?? today,
      changefreq: "monthly",
      priority: "0.6",
    });
  }

  // Changelog entries
  for (const entry of changelogEntries) {
    const slug = entry.slug?.current;
    if (slug) {
      urls.push({
        path: `/changelog/${slug}`,
        lastmod: entry.releaseDate ?? today,
        changefreq: "monthly",
        priority: "0.5",
      });
    }
  }

  // Fumadocs pages
  for (const page of docsPages) {
    urls.push({ path: page.url, lastmod: today, changefreq: "weekly", priority: "0.8" });
  }

  const urlEntries = urls
    .map(
      (u) => `  <url>
    <loc>${SITE_URL}${u.path}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
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
