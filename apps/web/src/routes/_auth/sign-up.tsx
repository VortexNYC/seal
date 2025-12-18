import { SignUp } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/sign-up")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<SignUp
			routing="virtual"
			appearance={{
				elements: {
					logoBox: {
						height: "80px",
						marginBottom: "16px",
					},
					logoImage: {
						height: "80px",
						width: "auto",
					},
				},
			}}
		/>
	);
}
