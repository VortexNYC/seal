import { TaskChooseOrganization } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
	"/_authenticated/onboarding/choose-organization/",
)({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<TaskChooseOrganization
			redirectUrlComplete="/app"
			appearance={{
				elements: {
					rootBox: "mx-auto",
				},
			}}
		/>
	);
}
