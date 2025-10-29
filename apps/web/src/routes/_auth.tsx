import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4 sm:px-6 lg:px-8">
			<div className="w-full max-w-md mx-auto">
				<div className="mb-6 sm:mb-8">
					<Link to="/" className="flex items-center justify-center">
						<span className="text-2xl sm:text-3xl font-bold">Seal</span>
					</Link>
				</div>
				<Outlet />
			</div>
		</div>
	);
}
