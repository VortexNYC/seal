import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getAllPageSlugs, getChangelogList } from "~/lib/sanity/queries";
import { source } from "~/lib/source";

const SITE_URL = "https://seal.co";

interface SitemapUrl {
  path: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

const generateSitemap = createServerFn({ method: "GET" }).handler(async () => {
  const today = new Date().toISOString().split("T")[0] as string;

  // Fetch all dynamic content sources in parallel
  const [sanityPages, changelogEntries] = await Promise.all([
    getAllPageSlugs().catch(() => []),
    getChangelogList().catch(() => []),
  ]);

  const docsPages = source.getPages();

  const urls: SitemapUrl[] = [];

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

  return urls;
});

export const Route = createFileRoute("/sitemap.xml")({
  loader: async () => {
    const urls = await generateSitemap();

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

    throw new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  },
  component: () => null,
});
