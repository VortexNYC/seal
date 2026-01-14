import { SignIn } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { createPageMeta, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_auth/sign-in")({
	component: RouteComponent,
	head: () => createPageMeta(pageSEO.signIn, "/sign-in"),
});

function RouteComponent() {
	return (
		<SignIn
			routing="virtual"
			signUpUrl="/sign-up"
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
