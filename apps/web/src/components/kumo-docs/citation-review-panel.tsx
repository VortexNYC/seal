import type { JSX } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Crosshair, MapPin } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export type CitationBBox = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CitationField = {
  id: string;
  label: string;
  value: string;
  category?: string;
  severity?: string;
  bbox?: CitationBBox;
};

/**
 * Review extracted / annotated values against source bounding boxes.
 * Extend HumanReviewPanel capability — Seal/Kumo owned.
 */
export function CitationReviewPanel({
  fields,
  activeId,
  onFocus,
  onJumpToCitation,
  onDismiss,
  className,
  emptyLabel = "No citations yet",
}: {
  fields: CitationField[];
  activeId?: string | null;
  onFocus?: (field: CitationField) => void;
  onJumpToCitation?: (field: CitationField) => void;
  onDismiss?: () => void;
  className?: string;
  emptyLabel?: string;
}): JSX.Element {
  return (
    <div
      data-kumo-docs="citation-review"
      className={cn("flex h-full flex-col", className)}
    >
      <div className="border-border flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-sm font-medium">Citations</span>
        {onDismiss ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyLabel}</p>
        ) : (
          fields.map((field) => {
            const active = field.id === activeId;
            return (
              <button
                key={field.id}
                type="button"
                onClick={() => onFocus?.(field)}
                className={cn(
                  "border-border hover:bg-accent/60 w-full rounded-lg border p-3 text-left transition-colors",
                  active && "border-primary bg-accent"
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-foreground text-sm font-medium">
                    {field.label}
                  </span>
                  <div className="flex items-center gap-1">
                    {field.category ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {field.category}
                      </Badge>
                    ) : null}
                    {field.bbox ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1.5"
                        onClick={(event) => {
                          event.stopPropagation();
                          onJumpToCitation?.(field);
                        }}
                        aria-label={`Jump to page ${field.bbox.page}`}
                      >
                        <MapPin className="size-3.5" />
                        <span className="text-muted-foreground text-[10px] tabular-nums">
                          p.{field.bbox.page}
                        </span>
                      </Button>
                    ) : (
                      <Crosshair className="text-muted-foreground size-3.5 opacity-40" />
                    )}
                  </div>
                </div>
                <p className="text-muted-foreground line-clamp-3 text-xs text-pretty">
                  {field.value}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
