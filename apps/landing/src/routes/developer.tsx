import "fumadocs-ui/style.css";
import "fumadocs-openapi/css/preset.css";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { type CSSProperties } from "react";

import { ClientOnly } from "~/components/client-only";
import { getDeveloperPageTree } from "~/lib/docs/manifest";

const devPageTree = getDeveloperPageTree();

export const Route = createFileRoute("/developer")({
  component: DevLayoutRoute,
  head: () => ({
    meta: [
      { title: "Seal Developer Docs" },
      {
        name: "description",
        content:
          "API reference, webhooks, MCP integration, and developer guides for the Seal platform.",
      },
    ],
  }),
});

function DevLayoutRoute() {
  return (
    <RootProvider
      search={{
        options: {
          type: "static",
          api: "/api/search.json",
        },
      }}
      theme={{ enabled: false }}
    >
      <ClientOnly>
        <DocsLayout
          containerProps={{
            style: { "--fd-layout-width": "100vw" } as CSSProperties,
          }}
          tree={devPageTree}
          nav={{
            title: (
              <a href="/developer" className="text-base font-semibold">
                Developer
              </a>
            ),
          }}
        >
          <Outlet />
        </DocsLayout>
      </ClientOnly>
    </RootProvider>
  );
}
