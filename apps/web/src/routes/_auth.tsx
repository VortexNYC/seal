import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="from-muted/80 to-background dark:from-muted/35 dark:to-background flex min-h-dvh flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
