/**
 * Branding moved onto Signing settings — keep route as redirect.
 * Route: /{slug}/settings/branding → /{slug}/settings/signing#signing-chrome
 */

import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/settings/branding")(
  {
    component: BrandingRedirect,
  }
);

function BrandingRedirect() {
  const { slug } = Route.useParams();
  return (
    <Navigate
      to="/$slug/settings/signing"
      params={{ slug }}
      hash="signing-chrome"
      replace
    />
  );
}
