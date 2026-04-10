import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import { Suspense } from "react";
import { PageLastUpdate } from "~/components/docs/page-last-update";
import { renderDocsPageContent, preloadDocsPageContent } from "~/lib/docs/client-loader";
import { docsSource } from "~/lib/docs/server-source";

export const Route = createFileRoute("/docs/$")({
  component: DocsPageRoute,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const data = await serverLoader({ data: slugs });
    if (data.type === "docs") {
      await preloadDocsPageContent(data.path);
    }
    return data;
  },
});

const serverLoader = createServerFn({ method: "GET" })
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = docsSource.getPage(slugs);
    if (!page) throw notFound();

    return {
      type: "docs" as const,
      path: page.path,
      title: page.data.title,
      description: page.data.description,
      lastModified: page.data.lastModified?.toISOString() ?? null,
      toc: page.data.toc.map((item) => ({
        depth: item.depth,
        title: typeof item.title === "string" ? item.title : "",
        url: item.url,
      })),
    };
  });

function DocsPageRoute() {
  const loaderData = Route.useLoaderData();
  const lastModified = loaderData.lastModified ? new Date(loaderData.lastModified) : undefined;

  return (
    <DocsPage key={loaderData.path} toc={loaderData.toc}>
      <DocsTitle>{loaderData.title}</DocsTitle>
      {loaderData.description && (
        <DocsDescription>{loaderData.description}</DocsDescription>
      )}
      <DocsBody>
        <Suspense fallback={<div>Loading...</div>}>
          {renderDocsPageContent(loaderData.path)}
        </Suspense>
      </DocsBody>
      {lastModified ? <PageLastUpdate date={lastModified} /> : null}
    </DocsPage>
  );
}
