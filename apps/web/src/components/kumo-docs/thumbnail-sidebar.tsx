import type { JSX } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { SkeletonLine } from "@cloudflare/kumo/components/loader";

import { cn } from "@/lib/utils";

export type ThumbnailPage = {
  page: number;
  src?: string | null;
  label?: string;
};

/**
 * Page thumbnail rail — pairs with the PDF viewer (Extend document-viewer-sidebar).
 */
export function ThumbnailSidebar({
  pages,
  currentPage,
  onSelectPage,
  className,
  loading = false,
}: {
  pages: ThumbnailPage[];
  currentPage: number;
  onSelectPage: (page: number) => void;
  className?: string;
  loading?: boolean;
}): JSX.Element {
  return (
    <aside
      data-kumo-docs="thumbnail-sidebar"
      className={cn("flex h-full flex-col gap-2 overflow-y-auto p-3", className)}
      aria-label="Page thumbnails"
    >
      {loading
        ? Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1">
              <SkeletonLine className="mx-auto h-24 w-20 rounded-md" />
              <SkeletonLine className="mx-auto h-3 w-8" />
            </div>
          ))
        : pages.map((page) => {
            const active = page.page === currentPage;
            return (
              <Button
                key={page.page}
                type="button"
                variant="ghost"
                onClick={() => onSelectPage(page.page)}
                className={cn(
                  "flex h-auto flex-col items-center gap-1 rounded-lg p-1.5",
                  active && "bg-accent ring-ring ring-2"
                )}
                aria-current={active ? "page" : undefined}
              >
                <div className="border-border bg-background relative h-24 w-20 overflow-hidden rounded-md border shadow-xs">
                  {page.src ? (
                    <img
                      src={page.src}
                      alt=""
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                      {page.page}
                    </div>
                  )}
                </div>
                <span className="text-muted-foreground text-[11px] tabular-nums">
                  {page.label ?? page.page}
                </span>
              </Button>
            );
          })}
    </aside>
  );
}
