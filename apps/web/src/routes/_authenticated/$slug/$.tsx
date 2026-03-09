/**
 * Catch-all route for unmatched paths under /{slug}/*
 *
 * Displays the 404 page when a user navigates to a route that doesn't
 * exist within the workspace (e.g. /{slug}/nonexistent-page).
 */

import { createFileRoute } from "@tanstack/react-router";

import { NotFound } from "@/components/not-found";

export const Route = createFileRoute("/_authenticated/$slug/$")({
  component: NotFound,
});
