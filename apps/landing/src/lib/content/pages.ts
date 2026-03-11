import type { LandingPage } from "./types";

const pages: LandingPage[] = [];

const pagesBySlug = new Map(pages.map((page) => [page.slug, page]));

export function getAllPageSlugs(): Array<{ slug: string; updatedAt?: string }> {
  return pages.map((page) => ({ slug: page.slug, updatedAt: page.updatedAt }));
}

export function getPage(slug: string): LandingPage | null {
  return pagesBySlug.get(slug) ?? null;
}
