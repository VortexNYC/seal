import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
			<div className="mb-8">
				<Link to="/" className="flex items-center justify-center">
					<img
						src="/logos/zenthor-finance-logo-text.svg"
						alt="Zenthor Finance"
						className="h-12 w-auto"
					/>
				</Link>
			</div>
			<Outlet />
		</div>
	);
}
