/**
 * Developer Settings Index
 *
 * Redirects to the API Keys page by default.
 * Route: /{slug}/settings/developer
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/$slug/settings/developer/",
)({
	component: DeveloperIndex,
});

function DeveloperIndex() {
	const { slug } = Route.useParams();
	return <Navigate to="/$slug/settings/developer/api-keys" params={{ slug }} />;
}
