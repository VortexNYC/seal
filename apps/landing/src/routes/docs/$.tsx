import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocsBody, DocsDescription, DocsPage, DocsTitle, PageLastUpdate } from "fumadocs-ui/page";
import { Suspense, useMemo } from "react";
import { renderDocsPageContent } from "~/lib/docs/client-loader";
import { getDocsPage } from "~/lib/docs/manifest";

export const Route = createFileRoute("/docs/$")({
  component: DocsPageRoute,
});

function DocsPageRoute() {
  const { _splat } = Route.useParams();

  const slugs = useMemo(() => {
    return _splat ? _splat.split("/") : [];
  }, [_splat]);

  const page = useMemo(() => {
    return getDocsPage(slugs) ?? null;
  }, [slugs]);

  if (!page) {
    throw notFound();
  }

  const lastModified = page.lastModified ? new Date(page.lastModified) : undefined;

  return (
    <DocsPage key={page.url} toc={page.toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        <Suspense fallback={<div>Loading...</div>}>{renderDocsPageContent(page.path)}</Suspense>
      </DocsBody>
      {lastModified ? <PageLastUpdate date={lastModified} /> : null}
    </DocsPage>
  );
}
