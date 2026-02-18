import { createFileRoute, notFound } from "@tanstack/react-router";
import type { DocData } from "fumadocs-mdx/runtime/types";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsBody, DocsDescription, DocsPage, DocsTitle, PageLastUpdate } from "fumadocs-ui/page";
import { Suspense, useMemo } from "react";

import { source } from "~/lib/source";

export const Route = createFileRoute("/docs/$")({
  component: DocsPageRoute,
});

function DocsPageRoute() {
  const { _splat } = Route.useParams();

  const slugs = useMemo(() => {
    return _splat ? _splat.split("/") : [];
  }, [_splat]);

  const page = useMemo(() => {
    const p = source.getPage(slugs);
    if (!p) return null;
    return p as typeof p & { data: DocData };
  }, [slugs]);

  if (!page) {
    throw notFound();
  }

  const MDX = page.data.body;
  const lastModified = (page.data as DocData & { lastModified?: Date }).lastModified;

  return (
    <DocsPage key={page.url} toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <Suspense fallback={<div>Loading...</div>}>
          <MDX components={defaultMdxComponents} />
        </Suspense>
      </DocsBody>
      {lastModified ? <PageLastUpdate date={lastModified} /> : null}
    </DocsPage>
  );
}
