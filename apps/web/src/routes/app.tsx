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
	const ensureActiveOrganization = useMutation(
		api.check_membership.ensureActiveOrganization,
	);
	const [isFixingOrg, setIsFixingOrg] = useState(false);
	const [fixedSlug, setFixedSlug] = useState<string | null>(null);

	const isLoading = organizationStatus === undefined;
	const activeOrganizationSlug =
		fixedSlug ?? organizationStatus?.activeOrganizationSlug ?? null;
	const needsActiveOrgFix = organizationStatus?.needsActiveOrgFix ?? false;

	// Auto-fix activeOrganizationId if user has membership but no active org set
	useEffect(() => {
		if (!isLoading && needsActiveOrgFix && !isFixingOrg && !fixedSlug) {
			setIsFixingOrg(true);
			ensureActiveOrganization({})
				.then((result) => {
					if (result.success && result.activeOrganizationSlug) {
						setFixedSlug(result.activeOrganizationSlug);
					}
				})
				.catch((error) => {
					console.error("Failed to fix active organization:", error);
				})
				.finally(() => {
					setIsFixingOrg(false);
				});
		}
	}, [
		isLoading,
		needsActiveOrgFix,
		isFixingOrg,
		fixedSlug,
		ensureActiveOrganization,
	]);

	// Show loading state while checking authentication or fixing organization
	if (isLoading || isFixingOrg) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
					<p className="text-gray-600">
						{isFixingOrg ? "Setting up your workspace..." : "Loading..."}
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

	// Fallback - redirect to onboarding if no organization
	return <Navigate to="/onboarding/choose-organization" replace />;
}
