// Root route — redirects authenticated users to /app
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/app" replace />,
});
