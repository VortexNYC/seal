// Root route — redirects authenticated users to /app
import { createFileRoute, Navigate } from "@tanstack/react-router";

/** Redirect root path to the main app view. */
export const Route = createFileRoute("/")({
  component: () => <Navigate to="/app" replace />,
});
