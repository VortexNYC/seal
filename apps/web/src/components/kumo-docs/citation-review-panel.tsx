import { Text } from "@cloudflare/kumo/components/text";
import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { Crosshair, MapPin } from "@phosphor-icons/react";
import type { JSX } from "react";

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
      <div className="border-kumo-line flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-sm font-medium">Citations</span>
        {onDismiss ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {fields.length === 0 ? (
          <Text as="p" variant="secondary" size="sm">{emptyLabel}</Text>
        ) : (
          fields.map((field) => {
            const active = field.id === activeId;
            return (
              <Button
                key={field.id}
                type="button"
                variant={active ? "secondary" : "ghost"}
                className="h-auto w-full justify-start"
                onClick={() => onFocus?.(field)}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-kumo-default text-sm font-medium">
                    {field.label}
                  </span>
                  <div className="flex items-center gap-1">
                    {field.category ? (
                      <Badge variant="secondary">
                        {field.category}
                      </Badge>
                    ) : null}
                    {field.bbox ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          onJumpToCitation?.(field);
                        }}
                        aria-label={`Jump to page ${field.bbox.page}`}
                      >
                        <MapPin className="size-3.5" />
                        <span className="text-kumo-secondary text-xs tabular-nums">
                          p.{field.bbox.page}
                        </span>
                      </Button>
                    ) : (
                      <Crosshair className="text-kumo-secondary size-3.5 opacity-40" />
                    )}
                  </div>
                </div>
                <Text as="p" variant="secondary" size="xs" DANGEROUS_className="line-clamp-3">{field.value}</Text>
              </Button>
            );
          })
        )}
      </div>
    </div>
  );
}
