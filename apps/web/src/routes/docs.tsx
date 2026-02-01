import "fumadocs-ui/style.css";
import "@/styles/docs-theme.css";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { SealLogoBadgeFixed } from "@/components/seal-logo-fixed";
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
			<DocsLayout
				tree={source.pageTree}
				nav={{
					title: (
						<span className="mx-auto">
							<SealLogoBadgeFixed size={48} withText />
						</span>
					),
					url: "/docs",
				}}
			>
				<Outlet />
			</DocsLayout>
		</RootProvider>
	);
}
