/**
 * Accept Invite Route
 *
 * Handles Clerk organization invitation acceptance
 * When a user clicks an invitation link, Clerk automatically handles the signup/signin
 * and redirects back to the app. This route is just a landing page.
 */

import { useAuth } from "@clerk/clerk-react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_auth/accept-invite")({
	component: AcceptInviteRoute,
});

function AcceptInviteRoute() {
	const { isSignedIn, isLoaded } = useAuth();

	useEffect(() => {
		// Log for debugging
		console.log("[AcceptInvite] isSignedIn:", isSignedIn, "isLoaded:", isLoaded);
		console.log("[AcceptInvite] Current URL:", window.location.href);
	}, [isSignedIn, isLoaded]);

	// Wait for Clerk to load
	if (!isLoaded) {
		return (
			<div className="flex h-screen flex-col items-center justify-center gap-2 text-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
				<p className="text-sm text-muted-foreground">Loading...</p>
			</div>
		);
	}

	// If user is already signed in, redirect to app
	if (isSignedIn) {
		console.log("[AcceptInvite] User signed in, redirecting to /app");
		return <Navigate to="/app" replace />;
	}

	// If not signed in, Clerk should have automatically redirected to sign-in/sign-up
	// If we reach here, something went wrong, so redirect to sign-up
	console.log("[AcceptInvite] Not signed in, redirecting to /sign-up");
	return <Navigate to="/sign-up" replace />;
}
