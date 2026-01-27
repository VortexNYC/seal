import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";

export const Route = createFileRoute("/docs")({
	component: DocsLayoutRoute,
});

function DocsLayoutRoute() {
	return (
		<DocsLayout tree={source.pageTree}>
			<Outlet />
		</DocsLayout>
	);
}
