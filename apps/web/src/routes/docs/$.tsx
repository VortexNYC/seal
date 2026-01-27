import { createFileRoute, notFound } from "@tanstack/react-router";
import type { DocData } from "fumadocs-mdx/runtime/types";
import defaultMdxComponents from "fumadocs-ui/mdx";
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from "fumadocs-ui/page";
import { Suspense } from "react";
import { source } from "@/lib/source";

export const Route = createFileRoute("/docs/$")({
	component: DocsPageRoute,
	loader: async ({ params }) => {
		const slugs = (params as Record<string, string>).$?.split("/") ?? [];
		const page = source.getPage(slugs);

		if (!page) {
			throw notFound();
		}

		return { page: page as typeof page & { data: DocData } };
	},
});

function DocsPageRoute() {
	const { page } = Route.useLoaderData();
	const MDX = page.data.body;

	return (
		<DocsPage toc={page.data.toc}>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<DocsBody>
				<Suspense fallback={<div>Loading...</div>}>
					<MDX components={defaultMdxComponents} />
				</Suspense>
			</DocsBody>
		</DocsPage>
	);
}
