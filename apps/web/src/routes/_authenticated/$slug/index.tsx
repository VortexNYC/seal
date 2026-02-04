/**
 * Workspace Index Route
 *
 * Redirects to the home page
 * Route: /{slug}
 */

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$slug/home",
      params: { slug: params.slug },
    });
  },
});
