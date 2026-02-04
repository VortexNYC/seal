/**
 * Documents Layout
 *
 * Layout wrapper for all documents-related pages
 * Route: /{slug}/documents/*
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/documents")({
  component: DocumentsLayout,
});

function DocumentsLayout() {
  return <Outlet />;
}
