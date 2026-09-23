import type { JSX } from "react";

import { cn } from "@/lib/utils";

export type LayoutBlockType =
  | "text"
  | "table"
  | "figure"
  | "heading"
  | "list"
  | "other";

export type LayoutBlock = {
  id: string;
  type: LayoutBlockType;
  page: number;
  /** Normalized 0–1 page coords */
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  confidence?: number;
};

export type LayoutBlocksPanelProps = {
  blocks: LayoutBlock[];
  activeId?: string | null;
  className?: string;
  onSelect?: (block: LayoutBlock) => void;
  onJumpPage?: (page: number) => void;
};

export type LayoutBlockOverlayProps = {
  blocks: LayoutBlock[];
  page: number;
  pageWidth: number;
  pageHeight: number;
  activeId?: string | null;
  className?: string;
  onSelect?: (block: LayoutBlock) => void;
};

/**
 * Layout / OCR block list — Extend layout-blocks panel, Kumo-owned.
 */
export function LayoutBlocksPanel({
  blocks,
  activeId,
  className,
  onSelect,
  onJumpPage,
}: LayoutBlocksPanelProps): JSX.Element {
  return (
    <div
      data-kumo-docs="layout-blocks-panel"
      className={cn("flex h-full flex-col", className)}
    >
      <div className="border-border border-b px-3 py-2 text-sm font-medium">
        Layout blocks
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {blocks.length === 0 ? (
          <p className="text-muted-foreground p-2 text-sm">No blocks.</p>
        ) : (
          blocks.map((block) => {
            const active = block.id === activeId;
            return (
              <button
                key={block.id}
                type="button"
                className={cn(
                  "border-border hover:bg-accent w-full rounded-md border px-2 py-2 text-left text-xs",
                  active && "border-primary bg-accent"
                )}
                onClick={() => {
                  onSelect?.(block);
                  onJumpPage?.(block.page);
                }}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">{block.type}</span>
                  <span className="text-muted-foreground tabular-nums">
                    p.{block.page}
                  </span>
                </div>
                {block.text ? (
                  <p className="text-muted-foreground line-clamp-2">
                    {block.text}
                  </p>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Absolute overlay of layout blocks on a rendered PDF page.
 */
export function LayoutBlockOverlay({
  blocks,
  page,
  pageWidth,
  pageHeight,
  activeId,
  className,
  onSelect,
}: LayoutBlockOverlayProps): JSX.Element {
  const pageBlocks = blocks.filter((b) => b.page === page);

  return (
    <div
      data-kumo-docs="layout-block-overlay"
      className={cn("pointer-events-none absolute inset-0", className)}
      aria-hidden
    >
      {pageBlocks.map((block) => {
        const active = block.id === activeId;
        return (
          <button
            key={block.id}
            type="button"
            className={cn(
              "pointer-events-auto absolute border border-info/60 bg-info/10",
              active && "border-primary bg-primary/15 ring-primary/40 ring-2"
            )}
            style={{
              left: block.x * pageWidth,
              top: block.y * pageHeight,
              width: block.width * pageWidth,
              height: block.height * pageHeight,
            }}
            onClick={() => onSelect?.(block)}
            aria-label={block.type}
          />
        );
      })}
    </div>
  );
}
