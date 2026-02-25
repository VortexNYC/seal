/**
 * Contacts Layout
 *
 * Layout wrapper for all contacts-related pages
 * Route: /{slug}/contacts/*
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/contacts")({
  component: ContactsLayout,
});

function ContactsLayout() {
  return <Outlet />;
}
