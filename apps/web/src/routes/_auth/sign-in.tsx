import { SignIn, useAuth } from "@clerk/clerk-react";
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/sign-in")({
	component: RouteComponent,
});

function RouteComponent() {
	const { isSignedIn } = useAuth();

	if (isSignedIn) {
		return <Navigate to="/app" replace />;
	}

	return (
		<div>
			<SignIn routing="virtual" signUpUrl="/sign-up" />
		</div>
	);
}
