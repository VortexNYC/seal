import { createFileRoute, notFound } from "@tanstack/react-router";

import { PageBuilder } from "~/components/page-builder";
import { getPage } from "~/lib/content/pages";
import { generateJsonLd } from "~/lib/content/structured-data";
import type { LandingPage } from "~/lib/content/types";

export const Route = createFileRoute("/pages/$slug")({
  head: ({ loaderData }) => {
    const data = loaderData as { page: LandingPage } | undefined;
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
  loader: async ({ params }) => {
    const page = getPage(params.slug);
    if (!page) {
      throw notFound();
    }
    return { page };
  },
  component: PageContent,
});

function PageContent() {
  const { page } = Route.useLoaderData() as { page: LandingPage };

  return (
    <div className="min-h-dvh">
      <PageBuilder content={page.content} />
    </div>
  );
}
