import "fumadocs-ui/style.css";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { type CSSProperties } from "react";
import { ClientOnly } from "~/components/client-only";
import { getDocsPageTree } from "~/lib/docs/manifest";

const docsPageTree = getDocsPageTree();

export const Route = createFileRoute("/docs")({
  component: DocsLayoutRoute,
  head: () => ({
    meta: [
      { title: "Seal Docs" },
      {
        name: "description",
        content: "Learn how to use Seal to send documents, collect signatures, and get paid.",
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
      theme={{ enabled: false }}
    >
      <ClientOnly>
        <DocsLayout
          containerProps={{ style: { '--fd-layout-width': '100vw' } as CSSProperties }}
          tree={docsPageTree}
          nav={{
            title: (
              <a href="/docs" className="font-semibold text-base">
                Docs
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
