/**
 * EnforceOrganization Component
 *
 * Ensures that authenticated users have an organization membership.
 * If user has no organization, redirects to organization selection/creation flow.
 */

import { api } from "@seal/backend/convex/_generated/api";
import { Navigate, useLocation } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import {
	buildOrganizationPath,
	isPathWithinOrganization,
} from "@/lib/organization-path";

interface EnforceOrganizationProps {
	children: ReactNode;
}

export function EnforceOrganization({ children }: EnforceOrganizationProps) {
	const location = useLocation();
	const organizationStatus = useQuery(api.check_membership.hasOrganization);
	const isOnboardingRoute = location.pathname.startsWith("/onboarding");

	const isLoading = organizationStatus === undefined;
	const hasOrganization = organizationStatus?.hasOrganization ?? false;
	const activeOrganizationSlug =
		organizationStatus?.activeOrganizationSlug ?? null;

	console.log("[EnforceOrganization]", {
		pathname: location.pathname,
		isLoading,
		hasOrganization,
		activeOrganizationSlug,
		isOnboardingRoute,
	});

	if (isLoading) {
		console.log("[EnforceOrganization] Loading...");
		return null;
	}

	if (!hasOrganization || !activeOrganizationSlug) {
		return isOnboardingRoute ? (
			children
		) : (
			<Navigate to="/onboarding/choose-organization" replace />
		);
	}

	// Allow /onboarding/choose-organization even if user has an organization
	// (they might want to switch or create new workspace)
	if (
		isOnboardingRoute &&
		location.pathname === "/onboarding/choose-organization"
	) {
		return <>{children}</>;
	}

	// Redirect other onboarding routes if user already has organization
	if (isOnboardingRoute) {
		const params = new URLSearchParams(location.search ?? "");
		const returnTo = params.get("returnTo");
		const target = returnTo
			? buildOrganizationPath(activeOrganizationSlug, returnTo)
			: buildOrganizationPath(activeOrganizationSlug, "/home");

		return <Navigate to={target} replace />;
	}

	const isWithinOrg = isPathWithinOrganization(
		activeOrganizationSlug,
		location.pathname,
	);
	console.log("[EnforceOrganization] Path check:", {
		isWithinOrg,
		activeOrganizationSlug,
		pathname: location.pathname,
	});

	if (!isWithinOrg) {
		const redirectPath = buildOrganizationPath(activeOrganizationSlug, "/home");
		console.log("[EnforceOrganization] Redirecting to:", redirectPath);
		return <Navigate to={redirectPath} replace />;
	}

	console.log("[EnforceOrganization] Rendering children");
	return <>{children}</>;
}
