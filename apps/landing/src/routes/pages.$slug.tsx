import { createFileRoute, notFound } from "@tanstack/react-router";

import { PageBuilder } from "~/components/page-builder";
import { getPage } from "~/lib/content/pages";
import { generateJsonLd } from "~/lib/content/structured-data";
import type { LandingPage } from "~/lib/content/types";

export const Route = createFileRoute("/pages/$slug")({
  loader: async ({ params }): Promise<{ page: LandingPage }> => {
    const page = getPage(params.slug);
    if (!page) {
      throw notFound();
    }
    return { page };
  },
  head: ({ loaderData }) => {
    const data = loaderData;
    const page = data?.page;
    const schemas = page ? generateJsonLd(page) : [];

    return {
      meta: [
        { title: page?.seo?.title || page?.title || "Seal" },
        {
          name: "description",
          content: page?.seo?.description || "",
        },
        { property: "og:title", content: page?.seo?.title || page?.title },
        { property: "og:description", content: page?.seo?.description },
        ...(page?.seo?.ogImage?.src
          ? [{ property: "og:image", content: page.seo.ogImage.src }]
          : []),
      ],
      scripts: schemas.map((schema) => ({
        type: "application/ld+json",
        children: JSON.stringify(schema),
      })),
    };
  },
  component: PageContent,
});

function PageContent() {
  const { page } = Route.useLoaderData();

  return (
    <div className="min-h-dvh">
      <PageBuilder content={page.content} />
    </div>
  );
}
