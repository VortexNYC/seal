import { createFileRoute, notFound } from "@tanstack/react-router";

import { PageBuilder } from "~/components/page-builder";
import { getPage, type Page } from "~/lib/sanity/queries";
import { generateJsonLd } from "~/lib/sanity/structured-data";

export const Route = createFileRoute("/pages/$slug")({
  head: ({ loaderData }) => {
    const data = loaderData as { page: Page } | undefined;
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
        ...(page?.seo?.ogImage?.asset?.url
          ? [{ property: "og:image", content: page.seo.ogImage.asset.url }]
          : []),
      ],
      scripts: schemas.map((schema) => ({
        type: "application/ld+json",
        children: JSON.stringify(schema),
      })),
    };
  },
  // @ts-expect-error — TanStack Router generic inference limitation with $slug param routes
  loader: async ({ params }) => {
    const page = await getPage(params.slug);
    if (!page) {
      throw notFound();
    }
    return { page };
  },
  component: PageContent,
});

function PageContent() {
  const { page } = Route.useLoaderData() as { page: Page };

  return (
    <div className="min-h-dvh">
      <PageBuilder content={page.content || []} />
    </div>
  );
}
