import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
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
      <div className="border-kumo-line border-b px-3 py-2 text-sm font-medium">
        Layout blocks
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {blocks.length === 0 ? (
          <Text as="p" variant="secondary" size="sm" DANGEROUS_className="p-2">No blocks.</Text>
        ) : (
          blocks.map((block) => {
            const active = block.id === activeId;
            return (
              <Button
                key={block.id}
                type="button"
                variant={active ? "secondary" : "ghost"}
                className="h-auto w-full justify-start"
                onClick={() => {
                  onSelect?.(block);
                  onJumpPage?.(block.page);
                }}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-medium capitalize">{block.type}</span>
                  <span className="text-kumo-secondary tabular-nums">
                    p.{block.page}
                  </span>
                </div>
                {block.text ? (
                  <Text as="p" variant="secondary" DANGEROUS_className="line-clamp-2">{block.text}</Text>
                ) : null}
              </Button>
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
          <Button
            key={block.id}
            type="button"
            variant={active ? "primary" : "outline"}
            className="pointer-events-auto absolute p-0"
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
