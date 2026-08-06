import { z } from "zod";

import changelogManifestData from "../../../.source/changelog-manifest.json";
import type { ContentImage } from "../content/types";

// Landing tsconfig lib is ES2022; modern browsers have Array#toSorted (ES2023).
declare global {
  interface Array<T> {
    toSorted(compareFn?: (a: T, b: T) => number): T[];
  }
}

export interface ChangelogFeature {
  description?: string;
  image?: ContentImage;
  title: string;
}

export interface ChangelogManifestEntry {
  breakingChanges: string[];
  coverImage?: ContentImage;
  description?: string;
  features: ChangelogFeature[];
  fixes: string[];
  improvements: string[];
  lastModified?: string;
  path: string;
  releaseDate: string;
  slug: string;
  summary?: string;
  title: string;
  version: string;
}

const contentImageSchema = z.object({
  alt: z.string().optional(),
  height: z.number().optional(),
  src: z.string(),
  width: z.number().optional(),
});

const changelogFeatureSchema = z.object({
  description: z.string().optional(),
  image: contentImageSchema.optional(),
  title: z.string(),
});

const changelogManifestSchema = z.object({
  entries: z.array(
    z.object({
      breakingChanges: z.array(z.string()).optional(),
      coverImage: contentImageSchema.optional(),
      description: z.string().optional(),
      features: z.array(changelogFeatureSchema).optional(),
      fixes: z.array(z.string()).optional(),
      improvements: z.array(z.string()).optional(),
      lastModified: z.string().optional(),
      path: z.string(),
      releaseDate: z.string(),
      slug: z.string(),
      summary: z.string().optional(),
      title: z.string(),
      version: z.string(),
    })
  ),
});

const changelogManifest = changelogManifestSchema.parse(changelogManifestData);
const changelogEntries = changelogManifest.entries
  .map(
    (entry): ChangelogManifestEntry =>
      Object.assign({}, entry, {
        breakingChanges: entry.breakingChanges ?? [],
        features: entry.features ?? [],
        fixes: entry.fixes ?? [],
        improvements: entry.improvements ?? [],
      })
  )
  .toSorted((a, b) => b.releaseDate.localeCompare(a.releaseDate));
const changelogEntriesBySlug = Object.fromEntries(
  changelogEntries.map((entry) => [entry.slug, entry])
);

export function getChangelogEntries(): ChangelogManifestEntry[] {
  return changelogEntries;
}

export function getChangelogEntry(slug: string): ChangelogManifestEntry | null {
  return changelogEntriesBySlug[slug] ?? null;
}
