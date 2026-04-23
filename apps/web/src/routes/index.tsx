// Root redirect — sends all / traffic to the authenticated app shell
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/app" replace />,
});
