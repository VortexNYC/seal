import type { JSX } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

function identityPageOrder(pageCount: number): number[] {
  return Array.from({ length: pageCount }, (_, index) => index + 1);
}

export type DocumentPdfOpsPanelProps = {
  pageCount: number;
  currentPage?: number;
  className?: string;
  rotating?: boolean;
  organizing?: boolean;
  watermarking?: boolean;
  numbering?: boolean;
  cropping?: boolean;
  merging?: boolean;
  /** Other draft docs available to merge (publicId + name). */
  mergeCandidates?: Array<{ publicId: string; name: string }>;
  onRotate: (input: {
    degrees: 90 | 180 | 270;
    pages?: number[];
  }) => void;
  onOrganize: (input: { pages: number[] }) => void;
  onCrop: (input: {
    crops: Array<{
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }) => void;
  onWatermark: (input: {
    text: string;
    position: "diagonal" | "center" | "footer";
    pages?: number[];
  }) => void;
  onNumberPages: (input: {
    format: "n" | "n_of_m";
    position: "footer-center" | "footer-right" | "footer-left";
    prefix?: string;
  }) => void;
  onMerge: (input: { sourcePublicIds: string[]; title?: string }) => void;
};

function marginToCropRect(marginPercent: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const m = Math.min(45, Math.max(0, marginPercent));
  return {
    x: m,
    y: m,
    width: 100 - m * 2,
    height: 100 - m * 2,
  };
}

/**
 * Human PDF ops — rotate / organize / watermark / number / merge.
 * Mirrors matching seal_* agent tools.
 */
export function DocumentPdfOpsPanel({
  pageCount,
  currentPage = 1,
  className,
  rotating = false,
  organizing = false,
  watermarking = false,
  numbering = false,
  cropping = false,
  merging = false,
  mergeCandidates = [],
  onRotate,
  onOrganize,
  onCrop,
  onWatermark,
  onNumberPages,
  onMerge,
}: DocumentPdfOpsPanelProps): JSX.Element {
  const [scope, setScope] = useState<"all" | "current">("all");
  const [pageOrder, setPageOrder] = useState<number[]>(() =>
    identityPageOrder(pageCount)
  );
  const [cropMargin, setCropMargin] = useState(5);
  const [watermarkText, setWatermarkText] = useState("DRAFT");
  const [watermarkPosition, setWatermarkPosition] = useState<
    "diagonal" | "center" | "footer"
  >("diagonal");
  const [numberFormat, setNumberFormat] = useState<"n" | "n_of_m">("n_of_m");
  const [numberPosition, setNumberPosition] = useState<
    "footer-center" | "footer-right" | "footer-left"
  >("footer-center");
  const [numberPrefix, setNumberPrefix] = useState("");
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const [mergeTitle, setMergeTitle] = useState("");

  useEffect(() => {
    setPageOrder(identityPageOrder(pageCount));
  }, [pageCount]);

  const organizeDirty =
    pageOrder.length !== pageCount ||
    pageOrder.some((page, index) => page !== index + 1);

  function movePage(index: number, delta: -1 | 1): void {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= pageOrder.length) return;
    setPageOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      if (item === undefined) return prev;
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function removePage(index: number): void {
    if (pageOrder.length <= 1) return;
    setPageOrder((prev) => prev.filter((_, i) => i !== index));
  }

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
          Organize pages
        </p>
        <p className="text-muted-foreground text-[11px]">
          Reorder or delete pages in this draft. Fields on removed pages are
          dropped.
        </p>
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {pageOrder.map((sourcePage, index) => (
            <li
              key={`${sourcePage}-${index}`}
              className="border-border flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <span className="text-muted-foreground w-8 shrink-0 font-mono text-xs">
                {index + 1}.
              </span>
              <span className="min-w-0 flex-1 truncate">
                Source page {sourcePage}
                {sourcePage === currentPage ? " (viewing)" : ""}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={organizing || index === 0}
                onClick={() => movePage(index, -1)}
                aria-label={`Move source page ${sourcePage} up`}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={organizing || index === pageOrder.length - 1}
                onClick={() => movePage(index, 1)}
                aria-label={`Move source page ${sourcePage} down`}
              >
                ↓
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={organizing || pageOrder.length <= 1}
                onClick={() => removePage(index)}
                aria-label={`Delete source page ${sourcePage}`}
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={organizing || !organizeDirty}
            onClick={() => setPageOrder(identityPageOrder(pageCount))}
          >
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={organizing || !organizeDirty || pageOrder.length === 0}
            onClick={() => onOrganize({ pages: pageOrder })}
          >
            {organizing ? "Saving…" : "Apply page order"}
          </Button>
        </div>
      </div>

      <div className="border-border space-y-2 border-t pt-4">
        <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
          Rotate pages
        </p>
        <p className="text-muted-foreground text-[11px]">
          Turn the PDF before sending — whole document or the page you&apos;re
          on.
        </p>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant={scope === "all" ? "primary" : "ghost"}
            onClick={() => setScope("all")}
          >
            Entire PDF
          </Button>
          <Button
            type="button"
            size="sm"
            variant={scope === "current" ? "primary" : "ghost"}
            onClick={() => setScope("current")}
          >
            This page ({currentPage})
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
          Crop
        </p>
        <p className="text-muted-foreground text-[11px]">
          Trim equal margins (scan edges / letterhead junk). Uses the same
          Entire PDF / This page scope as rotate.
        </p>
        <div className="flex flex-wrap gap-1">
          {([2.5, 5, 10] as const).map((margin) => (
            <Button
              key={margin}
              type="button"
              size="sm"
              variant={cropMargin === margin ? "primary" : "ghost"}
              onClick={() => setCropMargin(margin)}
            >
              {margin}% margins
            </Button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={cropping || pageCount < 1 || cropMargin * 2 >= 100}
          onClick={() => {
            const rect = marginToCropRect(cropMargin);
            const pages =
              scope === "current"
                ? [currentPage]
                : identityPageOrder(pageCount);
            onCrop({
              crops: pages.map((page) => ({ page, ...rect })),
            });
          }}
        >
          {cropping ? "Cropping…" : "Apply crop"}
        </Button>
      </div>

      <div className="border-border space-y-2 border-t pt-4">
        <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
          Watermark
        </p>
        <p className="text-muted-foreground text-[11px]">
          Stamp text across the PDF before send (DRAFT, CONFIDENTIAL, …).
        </p>
        <Input
          label="Watermark text"
          value={watermarkText}
          onChange={(e) => setWatermarkText(e.target.value)}
          maxLength={120}
        />
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["diagonal", "Diagonal"],
              ["center", "Center"],
              ["footer", "Footer"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={watermarkPosition === value ? "primary" : "ghost"}
              onClick={() => setWatermarkPosition(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={
            watermarking || pageCount < 1 || watermarkText.trim().length === 0
          }
          onClick={() =>
            onWatermark({
              text: watermarkText.trim(),
              position: watermarkPosition,
              pages: scope === "current" ? [currentPage] : undefined,
            })
          }
        >
          {watermarking ? "Stamping…" : "Apply watermark"}
        </Button>
      </div>

      <div className="border-border space-y-2 border-t pt-4">
        <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
          Page numbers
        </p>
        <p className="text-muted-foreground text-[11px]">
          Footer stamps for assembled packs.
        </p>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["n_of_m", "1 of N"],
              ["n", "Number only"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={numberFormat === value ? "primary" : "ghost"}
              onClick={() => setNumberFormat(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["footer-center", "Center"],
              ["footer-left", "Left"],
              ["footer-right", "Right"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={numberPosition === value ? "primary" : "ghost"}
              onClick={() => setNumberPosition(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Input
          label="Prefix (optional)"
          placeholder='Prefix (optional), e.g. "Page "'
          value={numberPrefix}
          onChange={(e) => setNumberPrefix(e.target.value)}
          maxLength={40}
        />
        <Button
          type="button"
          size="sm"
          disabled={numbering || pageCount < 1}
          onClick={() =>
            onNumberPages({
              format: numberFormat,
              position: numberPosition,
              prefix: numberPrefix.trim() || undefined,
            })
          }
        >
          {numbering ? "Numbering…" : "Apply page numbers"}
        </Button>
      </div>

      <div className="border-border space-y-2 border-t pt-4">
        <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
          Combine with another draft
        </p>
        <p className="text-muted-foreground text-[11px]">
          Append other draft PDFs after this one into a new draft.
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
          label="Merged document title"
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
