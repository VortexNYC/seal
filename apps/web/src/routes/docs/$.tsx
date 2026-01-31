import {
	createFileRoute,
	notFound,
	useRouterState,
} from "@tanstack/react-router";
import type { DocData } from "fumadocs-mdx/runtime/types";
import defaultMdxComponents from "fumadocs-ui/mdx";
import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from "fumadocs-ui/page";
import { Suspense, useMemo } from "react";
import { source } from "@/lib/source";

export const Route = createFileRoute("/docs/$")({
	component: DocsPageRoute,
});

function DocsPageRoute() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	const slugs = useMemo(() => {
		const path = pathname.replace(/^\/docs\/?/, "");
		return path ? path.split("/") : [];
	}, [pathname]);

	const page = useMemo(() => {
		const p = source.getPage(slugs);
		if (!p) return null;
		return p as typeof p & { data: DocData };
	}, [slugs]);

	if (!page) {
		throw notFound();
	}

	const MDX = page.data.body;

	return (
		<DocsPage key={page.url} toc={page.data.toc}>
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
