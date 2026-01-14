import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { EnforceOrganization } from "@/components/enforce-organization";

export const Route = createFileRoute("/_authenticated")({
	component: AuthenticatedLayout,
	head: () => ({
		meta: [
			// Prevent search engines from indexing authenticated pages
			{ name: "robots", content: "noindex, nofollow" },
		],
	}),
});

function AuthenticatedLayout() {
	return (
		<>
			<SignedOut>
				<Navigate to="/sign-in" />
			</SignedOut>
			<SignedIn>
				<EnforceOrganization>
					<Outlet />
				</EnforceOrganization>
			</SignedIn>
		</>
	);
}
