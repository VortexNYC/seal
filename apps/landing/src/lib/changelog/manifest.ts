import changelogManifestData from "../../../.source/changelog-manifest.json";
import type { ContentImage } from "../content/types";

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

interface ChangelogManifest {
  entries: Array<
    Omit<ChangelogManifestEntry, "breakingChanges" | "features" | "fixes" | "improvements"> & {
      breakingChanges?: string[];
      features?: ChangelogFeature[];
      fixes?: string[];
      improvements?: string[];
    }
  >;
}

const changelogManifest = changelogManifestData as ChangelogManifest;
const changelogEntries = [...changelogManifest.entries]
  .map((entry) => ({
    ...entry,
    breakingChanges: entry.breakingChanges ?? [],
    features: entry.features ?? [],
    fixes: entry.fixes ?? [],
    improvements: entry.improvements ?? [],
  }))
  .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
const changelogEntriesBySlug = Object.fromEntries(
  changelogEntries.map((entry) => [entry.slug, entry]),
);

export function getChangelogEntries(): ChangelogManifestEntry[] {
  return changelogEntries;
}

export function getChangelogEntry(slug: string): ChangelogManifestEntry | null {
  return changelogEntriesBySlug[slug] ?? null;
}
