import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { buildOrganizationPath } from "@/lib/organization-path";

export const Route = createFileRoute("/app")({
	component: AppRedirect,
});

function AppRedirect() {
	return (
		<>
			<SignedOut>
				<Navigate to="/sign-in" replace />
			</SignedOut>
			<SignedIn>
				<AuthenticatedRedirect />
			</SignedIn>
		</>
	);
}

function AuthenticatedRedirect() {
	const organizationStatus = useQuery(api.check_membership.hasOrganization);
	const [isCreatingOrg, setIsCreatingOrg] = useState(false);
	const ensurePersonalOrganization = useMutation(
		api.organizations.mutations.ensurePersonalOrganization,
	);

	const isLoading = organizationStatus === undefined;
	const hasOrganization = organizationStatus?.hasOrganization ?? false;
	const activeOrganizationSlug =
		organizationStatus?.activeOrganizationSlug ?? null;

	// Auto-create personal organization for authenticated users without one
	useEffect(() => {
		if (!isLoading && !hasOrganization && !isCreatingOrg) {
			setIsCreatingOrg(true);
			ensurePersonalOrganization({}).catch((error) => {
				console.error("Failed to create personal organization:", error);
				setIsCreatingOrg(false);
			});
		}
	}, [isLoading, hasOrganization, isCreatingOrg, ensurePersonalOrganization]);

	// Show loading state while checking authentication or creating organization
	if (isLoading || isCreatingOrg) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
					<p className="text-gray-600">
						{isCreatingOrg ? "Setting up your workspace..." : "Loading..."}
					</p>
				</div>
			</div>
		);
	}

	// Redirect to their workspace
	if (activeOrganizationSlug) {
		return (
			<Navigate
				to={buildOrganizationPath(activeOrganizationSlug, "/home")}
				replace
			/>
		);
	}

	// Fallback - shouldn't reach here but redirect to onboarding if needed
	return <Navigate to="/onboarding/choose-organization" replace />;
}
