declare module "fumadocs-mdx:collections/server" {
  import type { DocCollectionEntry, DocsCollectionEntry } from "fumadocs-mdx/runtime/server";

  export const docs: DocsCollectionEntry;
  export const changelog: DocCollectionEntry<"changelog">[];
}

declare module "fumadocs-mdx:collections/browser" {
  import type { DocCollectionEntry } from "fumadocs-mdx/runtime/browser";

  const browserCollections: {
    changelog: DocCollectionEntry<"changelog">;
    docs: DocCollectionEntry<"docs">;
  };

  export default browserCollections;
}
