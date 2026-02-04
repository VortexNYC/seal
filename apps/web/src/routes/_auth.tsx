import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
