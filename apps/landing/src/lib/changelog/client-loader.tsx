import browserCollections from "fumadocs-mdx:collections/browser";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ReactNode } from "react";

const changelogClientLoader = browserCollections.changelog.createClientLoader({
  id: "seal-changelog-content",
  component: (loaded): ReactNode => {
    const MDXContent = loaded.default;
    return <MDXContent components={defaultMdxComponents} />;
  },
});

export async function preloadChangelogContent(path: string): Promise<void> {
  await changelogClientLoader.preload(path);
}

export function renderChangelogContent(path: string): ReactNode {
  return changelogClientLoader.useContent(path);
}
