import type { JSX } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { useState } from "react";

import { cn } from "@/lib/utils";

export type DocumentPdfOpsPanelProps = {
  pageCount: number;
  currentPage?: number;
  className?: string;
  rotating?: boolean;
  merging?: boolean;
  /** Other draft docs available to merge (publicId + name). */
  mergeCandidates?: Array<{ publicId: string; name: string }>;
  onRotate: (input: {
    degrees: 90 | 180 | 270;
    pages?: number[];
  }) => void;
  onMerge: (input: { sourcePublicIds: string[]; title?: string }) => void;
};

/**
 * Human PDF ops — rotate + merge. Mirrors agent seal_rotate / seal_merge tools.
 */
export function DocumentPdfOpsPanel({
  pageCount,
  currentPage = 1,
  className,
  rotating = false,
  merging = false,
  mergeCandidates = [],
  onRotate,
  onMerge,
}: DocumentPdfOpsPanelProps): JSX.Element {
  const [scope, setScope] = useState<"all" | "current">("all");
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const [mergeTitle, setMergeTitle] = useState("");

  function toggleMergeId(id: string): void {
    setSelectedMergeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div
      data-kumo-docs="document-pdf-ops"
      className={cn("space-y-4 p-4", className)}
    >
      <div className="space-y-2">
        <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
          Rotate
        </p>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant={scope === "all" ? "primary" : "ghost"}
            onClick={() => setScope("all")}
          >
            All pages
          </Button>
          <Button
            type="button"
            size="sm"
            variant={scope === "current" ? "primary" : "ghost"}
            onClick={() => setScope("current")}
          >
            Page {currentPage}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {([90, 180, 270] as const).map((deg) => (
            <Button
              key={deg}
              type="button"
              size="sm"
              variant="outline"
              disabled={rotating || pageCount < 1}
              onClick={() =>
                onRotate({
                  degrees: deg,
                  pages: scope === "current" ? [currentPage] : undefined,
                })
              }
            >
              {deg}°
            </Button>
          ))}
        </div>
      </div>

      <div className="border-border space-y-2 border-t pt-4">
        <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
          Merge into new draft
        </p>
        <p className="text-muted-foreground text-[11px]">
          Select other draft PDFs to append after this document.
        </p>
        {mergeCandidates.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No other draft documents available.
          </p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {mergeCandidates.map((doc) => {
              const checked = selectedMergeIds.includes(doc.publicId);
              return (
                <li key={doc.publicId}>
                  <label className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMergeId(doc.publicId)}
                      className="accent-foreground"
                    />
                    <span className="truncate">{doc.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <Input
          placeholder="Merged document title (optional)"
          value={mergeTitle}
          onChange={(e) => setMergeTitle(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          disabled={merging || selectedMergeIds.length === 0}
          onClick={() =>
            onMerge({
              sourcePublicIds: selectedMergeIds,
              title: mergeTitle.trim() || undefined,
            })
          }
        >
          {merging ? "Merging…" : "Merge PDFs"}
        </Button>
      </div>
    </div>
  );
}
