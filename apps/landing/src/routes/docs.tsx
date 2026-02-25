import "fumadocs-ui/style.css";
import "~/styles/docs-theme.css";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/tanstack";

import { source } from "~/lib/source";

export const Route = createFileRoute("/docs")({
  component: DocsLayoutRoute,
  head: () => ({
    meta: [
      { title: "Seal Documentation" },
      {
        name: "description",
        content:
          "Comprehensive documentation for the Seal document signature platform. API reference, webhooks, MCP integration, and getting started guides.",
      },
    ],
  }),
});

function DocsLayoutRoute() {
  return (
    <RootProvider
      search={{
        options: {
          type: "static",
          api: "/api/search.json",
        },
      }}
    >
      <DocsLayout
        tree={source.pageTree}
        nav={{
          title: <span className="text-lg font-semibold">Seal Docs</span>,
          url: "/docs",
        }}
      >
        <Outlet />
      </DocsLayout>
    </RootProvider>
  );
}
