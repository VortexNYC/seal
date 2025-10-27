import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/settings/team")({
	component: TeamLayout,
});

function TeamLayout() {
	return <Outlet />;
}
