import browserCollections from "fumadocs-mdx:collections/browser";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ReactNode } from "react";

const mdxComponent = (loaded: { default: React.ComponentType<{ components: typeof defaultMdxComponents }> }): ReactNode => {
  const MDXContent = loaded.default;
  return <MDXContent components={defaultMdxComponents} />;
};

const docsClientLoader = browserCollections.docs.createClientLoader({
  id: "seal-docs-content",
  component: mdxComponent,
});

const developerClientLoader = browserCollections.developer.createClientLoader({
  id: "seal-developer-content",
  component: mdxComponent,
});

export async function preloadDocsPageContent(path: string): Promise<void> {
  await docsClientLoader.preload(path);
}

export function renderDocsPageContent(path: string): ReactNode {
  return docsClientLoader.useContent(path);
}

export async function preloadDeveloperPageContent(path: string): Promise<void> {
  await developerClientLoader.preload(path);
}

export function renderDeveloperPageContent(path: string): ReactNode {
  return developerClientLoader.useContent(path);
}
