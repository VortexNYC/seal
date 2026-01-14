import { SignUp } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { getCanonicalUrl, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_auth/sign-up")({
	component: RouteComponent,
	head: () => ({
		meta: [
			{ title: pageSEO.signUp.title },
			{ name: "description", content: pageSEO.signUp.description },
			{ property: "og:title", content: pageSEO.signUp.title },
			{ property: "og:description", content: pageSEO.signUp.description },
		],
		links: [{ rel: "canonical", href: getCanonicalUrl("/sign-up") }],
	}),
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
