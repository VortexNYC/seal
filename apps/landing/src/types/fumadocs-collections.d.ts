declare module "fumadocs-mdx:collections/server" {
  import type { DocsCollectionEntry } from "fumadocs-mdx/runtime/server";

  export const docs: DocsCollectionEntry;
}

declare module "fumadocs-mdx:collections/browser" {
  import type { DocCollectionEntry } from "fumadocs-mdx/runtime/browser";

  const browserCollections: {
    docs: DocCollectionEntry<"docs">;
  };

  export default browserCollections;
}
