import browserCollections from "fumadocs-mdx:collections/browser";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ReactNode } from "react";

const docsClientLoader = browserCollections.docs.createClientLoader({
  id: "seal-docs-content",
  component: (loaded): ReactNode => {
    const MDXContent = loaded.default;
    return <MDXContent components={defaultMdxComponents} />;
  },
});

export async function preloadDocsPageContent(path: string): Promise<void> {
  await docsClientLoader.preload(path);
}

export function renderDocsPageContent(path: string): ReactNode {
  return docsClientLoader.useContent(path);
}
