/**
 * Accept Invite Route
 *
 * Handles Clerk invitation links and redirects to signup with prefilled email
 */

import { useClerk } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@seal/backend/convex/_generated/api";
import { useAction } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_auth/accept-invite")({
	component: AcceptInviteRoute,
});

function AcceptInviteRoute() {
	const { redirectToSignUp, redirectToSignIn, buildSignUpUrl } = useClerk();
	const [error, setError] = useState<string | null>(null);
	const getInvitationEmail = useAction(
		api.organizations.actions.getInvitationEmailByClerkId,
	);

	const afterSignUpUrl = useMemo(() => {
		if (typeof window === "undefined") {
			return "/app";
		}
		const params = new URLSearchParams(window.location.search);
		const requestedRedirect = params.get("redirect_url");
		if (requestedRedirect?.startsWith("/")) {
			return requestedRedirect;
		}
		// Default to /app which will redirect to user's organization
		return "/app";
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const params = new URLSearchParams(window.location.search);
		const clerkTicket =
			params.get("__clerk_ticket") ??
			params.get("clerk_ticket") ??
			params.get("__clerk_invitation_token") ??
			params.get("clerk_invitation_token");

		void (async () => {
			try {
				if (!clerkTicket) {
					setError("Invite link is missing a ticket or has expired.");
					return;
				}

				const baseSignUpUrl = buildSignUpUrl();
				if (baseSignUpUrl) {
					try {
						const signUpUrl = new URL(baseSignUpUrl, window.location.origin);

						// Preserve all incoming params (e.g., __clerk_ticket, email_address)
						for (const [key, value] of params.entries()) {
							signUpUrl.searchParams.set(key, value);
						}

						// Ensure Clerk gets the canonical ticket param name
						if (!params.get("__clerk_ticket") && params.get("clerk_ticket")) {
							signUpUrl.searchParams.set(
								"__clerk_ticket",
								params.get("clerk_ticket") as string,
							);
						}

						// Prefill email if available via query or by decoding ticket
						let emailParam = params.get("email_address") ?? params.get("email");
						if (!emailParam) {
							// Try to decode the ticket (JWT) and pull the Clerk invitation id
							try {
								const parts = (clerkTicket as string).split(".");
								if (parts.length >= 2) {
									const payload = JSON.parse(
										atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
									);
									const sid: string | undefined = payload?.sid;
									if (sid?.startsWith("orginv_")) {
										const res = await getInvitationEmail({
											clerkInvitationId: sid,
										});
										if (res?.email) emailParam = res.email;
									}
								}
							} catch {
								// Best-effort only; ignore failures
							}
						}

						if (emailParam) {
							signUpUrl.searchParams.set("email_address", emailParam);
							signUpUrl.searchParams.set("identifier", emailParam);
						}

						const absoluteAfterSignUp = new URL(
							afterSignUpUrl,
							window.location.origin,
						).toString();
						signUpUrl.searchParams.set("redirect_url", absoluteAfterSignUp);

						window.location.replace(signUpUrl.toString());
						return;
					} catch (err) {
						console.warn("Failed to construct sign-up URL, falling back", err);
					}
				}

				// Fallback to simple redirect
				await redirectToSignUp({
					afterSignUpUrl,
				});
			} catch (err) {
				console.error("Failed to redirect to Clerk sign-up", err);
				setError(
					"We couldn't open the sign-up page. Please request a new invite or contact support.",
				);
			}
		})();
	}, [afterSignUpUrl, buildSignUpUrl, redirectToSignUp, getInvitationEmail]);

	if (error) {
		return (
			<div className="flex h-screen flex-col items-center justify-center gap-4 px-4 text-center">
				<div className="space-y-2">
					<h1 className="text-lg font-semibold">Unable to start sign-up</h1>
					<p className="text-sm text-muted-foreground">{error}</p>
				</div>
				<Button
					onClick={() => {
						void redirectToSignIn();
					}}
				>
					Go to sign-in
				</Button>
			</div>
		);
	}

	return (
		<div className="flex h-screen flex-col items-center justify-center gap-2 text-center text-muted-foreground">
			<p className="text-sm">Preparing your account...</p>
			<p className="text-xs">
				If nothing happens, please re-open the invitation link.
			</p>
		</div>
	);
}
