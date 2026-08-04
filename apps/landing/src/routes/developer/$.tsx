import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import { Suspense } from "react";

import { ClientAPIPage } from "~/components/api-page";
import { PageLastUpdate } from "~/components/docs/page-last-update";
import {
  renderDeveloperPageContent,
  preloadDeveloperPageContent,
} from "~/lib/docs/client-loader";
import { developerSource } from "~/lib/docs/server-source";

export const Route = createFileRoute("/developer/$")({
  component: DevPageRoute,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const data = await serverLoader({ data: slugs });
    if (data.type === "docs") {
      await preloadDeveloperPageContent(data.path);
    }
    return data;
  },
});

const serverLoader = createServerFn({ method: "GET" })
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = developerSource.getPage(slugs);
    if (!page) throw notFound();

    if (page.data.type === "openapi") {
      return {
        type: "openapi" as const,
        title: page.data.title,
        description: page.data.description,
        props: await page.data.getClientAPIPageProps(),
      };
    }

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

function DevPageRoute() {
  const loaderData = Route.useLoaderData();

  if (loaderData.type === "openapi") {
    return (
      <DocsPage full>
        <DocsTitle>{loaderData.title}</DocsTitle>
        {loaderData.description && (
          <DocsDescription>{loaderData.description}</DocsDescription>
        )}
        <DocsBody>
          <ClientAPIPage {...loaderData.props} />
        </DocsBody>
      </DocsPage>
    );
  }

  const lastModified = loaderData.lastModified
    ? new Date(loaderData.lastModified)
    : undefined;

  return (
    <DocsPage key={loaderData.path} toc={loaderData.toc}>
      <DocsTitle>{loaderData.title}</DocsTitle>
      {loaderData.description && (
        <DocsDescription>{loaderData.description}</DocsDescription>
      )}
      <DocsBody>
        <Suspense fallback={<div>Loading...</div>}>
          {renderDeveloperPageContent(loaderData.path)}
        </Suspense>
      </DocsBody>
      {lastModified ? <PageLastUpdate date={lastModified} /> : null}
    </DocsPage>
  );
}
