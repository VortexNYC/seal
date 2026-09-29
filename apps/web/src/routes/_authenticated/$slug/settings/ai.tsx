/**
 * AI settings retired from product nav (SEA-94) — unused until AI ships.
 * Keep the file route so deep links redirect instead of 404 mid-session.
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/settings/ai")({
  component: AiSettingsRedirect,
});

function AiSettingsRedirect() {
  const { slug } = Route.useParams();
  return <Navigate to="/$slug/settings" params={{ slug }} replace />;
}
