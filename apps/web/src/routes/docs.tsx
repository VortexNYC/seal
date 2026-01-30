import "fumadocs-ui/style.css";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { source } from "@/lib/source";

export const Route = createFileRoute("/docs")({
	component: DocsLayoutRoute,
});

function DocsLayoutRoute() {
	return (
		<RootProvider
			search={{
				options: {
					type: "static",
				},
			}}
		>
			<DocsLayout tree={source.pageTree}>
				<Outlet />
			</DocsLayout>
		</RootProvider>
	);
}
