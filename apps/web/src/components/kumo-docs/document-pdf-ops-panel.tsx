import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Input } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import { Text } from "@cloudflare/kumo/components/text";
import type { JSX } from "react";
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
  compressing?: boolean;
  redacting?: boolean;
  protecting?: boolean;
  flattening?: boolean;
  exporting?: boolean;
  officing?: boolean;
  ocred?: boolean;
  comparing?: boolean;
  pdfaing?: boolean;
  merging?: boolean;
  /** Download URL for the last protected copy this session produced. */
  protectedDownloadUrl?: string | null;
  /** Download URL for the last exported images ZIP this session produced. */
  imagesDownloadUrl?: string | null;
  /** Download URL for the last Office export this session produced. */
  officeDownloadUrl?: string | null;
  /** Last compare result produced this session. */
  compareResult?: {
    pagesDifferent: number;
    linesAdded: number;
    linesRemoved: number;
    pages: Array<{ page: number; added: string[]; removed: string[] }>;
  } | null;
  /** Other draft docs available to merge/compare (publicId + name). */
  mergeCandidates?: Array<{ publicId: string; name: string }>;
  onRotate: (input: { degrees: 90 | 180 | 270; pages?: number[] }) => void;
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
  onCompress: (input: { imageQuality?: number }) => void;
  onRedact: (input: {
    regions: Array<{
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }) => void;
  onProtect: (input: { userPassword?: string; ownerPassword?: string }) => void;
  onFlatten: () => void;
  onExportImages: (input: { format: "png" | "jpeg"; dpi: number }) => void;
  onToOffice: (input: { format: "docx" | "xlsx" | "pptx" }) => void;
  onOcr: (input: { lang: string }) => void;
  onCompare: (input: { withPublicId: string }) => void;
  onToPdfa: (input: { format: "PDF/A-1b" | "PDF/A-2b" | "PDF/A-3b" }) => void;
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
  compressing = false,
  redacting = false,
  protecting = false,
  flattening = false,
  exporting = false,
  officing = false,
  ocred = false,
  comparing = false,
  pdfaing = false,
  merging = false,
  protectedDownloadUrl = null,
  imagesDownloadUrl = null,
  officeDownloadUrl = null,
  compareResult = null,
  mergeCandidates = [],
  onRotate,
  onOrganize,
  onCrop,
  onWatermark,
  onNumberPages,
  onCompress,
  onRedact,
  onProtect,
  onFlatten,
  onExportImages,
  onToOffice,
  onOcr,
  onCompare,
  onToPdfa,
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
  const [compressQuality, setCompressQuality] = useState(80);
  const [redactRect, setRedactRect] = useState({
    x: "0",
    y: "0",
    width: "50",
    height: "10",
  });
  const [protectPassword, setProtectPassword] = useState("");
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg">("png");
  const [officeFormat, setOfficeFormat] = useState<"docx" | "xlsx" | "pptx">(
    "docx"
  );
  const [exportDpi, setExportDpi] = useState(150);
  const [ocrLang, setOcrLang] = useState("eng");
  const [compareTarget, setCompareTarget] = useState("");
  const [pdfaFormat, setPdfaFormat] = useState<
    "PDF/A-1b" | "PDF/A-2b" | "PDF/A-3b"
  >("PDF/A-2b");
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
        <Text size="xs">Organize pages</Text>
        <Text variant="secondary" size="xs">Reorder or delete pages in this draft. Fields on removed pages are
          dropped.</Text>
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {pageOrder.map((sourcePage, index) => (
            <li
              key={`${sourcePage}-${index}`}
              className="border-kumo-line flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <span className="text-kumo-secondary w-8 shrink-0 font-mono text-xs">
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

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Rotate pages</Text>
        <Text variant="secondary" size="xs">Turn the PDF before sending — whole document or the page you&apos;re
          on.</Text>
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

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Crop</Text>
        <Text variant="secondary" size="xs">Trim equal margins (scan edges / letterhead junk). Uses the same
          Entire PDF / This page scope as rotate.</Text>
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

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Watermark</Text>
        <Text variant="secondary" size="xs">Stamp text across the PDF before send (DRAFT, CONFIDENTIAL, …).</Text>
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

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Page numbers</Text>
        <Text variant="secondary" size="xs">Footer stamps for assembled packs.</Text>
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

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Compress</Text>
        <Text variant="secondary" size="xs">Shrink images for email-size packs. Text and layout stay intact.</Text>
        <div className="flex flex-wrap gap-1">
          {(
            [
              [60, "Smaller file"],
              [80, "Balanced"],
              [95, "Best quality"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={compressQuality === value ? "primary" : "ghost"}
              onClick={() => setCompressQuality(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={compressing || pageCount < 1}
          onClick={() => onCompress({ imageQuality: compressQuality })}
        >
          {compressing ? "Compressing…" : "Compress PDF"}
        </Button>
      </div>

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Redact region</Text>
        <Text variant="secondary" size="xs">Permanently remove content inside a box on this page — text under it
          is deleted, not just hidden. Values are % of page.</Text>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["x", "Left %"],
              ["y", "Top %"],
              ["width", "Width %"],
              ["height", "Height %"],
            ] as const
          ).map(([key, label]) => (
            <Input
              key={key}
              label={label}
              type="number"
              min={0}
              max={100}
              value={redactRect[key]}
              onChange={(e) =>
                setRedactRect((prev) => ({ ...prev, [key]: e.target.value }))
              }
            />
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={
            redacting ||
            pageCount < 1 ||
            Number(redactRect.width) <= 0 ||
            Number(redactRect.height) <= 0
          }
          onClick={() =>
            onRedact({
              regions: [
                {
                  page: currentPage,
                  x: Number(redactRect.x),
                  y: Number(redactRect.y),
                  width: Number(redactRect.width),
                  height: Number(redactRect.height),
                },
              ],
            })
          }
        >
          {redacting ? "Redacting…" : `Redact on page ${currentPage}`}
        </Button>
      </div>

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Protect with password</Text>
        <Text variant="secondary" size="xs">Make an encrypted copy to download — your working draft stays editable
          here.</Text>
        <Input
          label="Open password"
          type="password"
          value={protectPassword}
          onChange={(e) => setProtectPassword(e.target.value)}
          maxLength={128}
          autoComplete="off"
        />
        <Button
          type="button"
          size="sm"
          disabled={
            protecting || pageCount < 1 || protectPassword.trim().length === 0
          }
          onClick={() => onProtect({ userPassword: protectPassword.trim() })}
        >
          {protecting ? "Encrypting…" : "Create protected copy"}
        </Button>
        {protectedDownloadUrl ? (
          <a
            href={protectedDownloadUrl}
            target="_blank"
            rel="noreferrer"
            className="text-kumo-default block text-xs underline"
          >
            Download protected PDF
          </a>
        ) : null}
      </div>

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Flatten annotations &amp; forms</Text>
        <Text variant="secondary" size="xs">Bake annotation and form appearances into the page — interactive
          overlays become static content. Signature fields you placed here are
          unaffected.</Text>
        <Button
          type="button"
          size="sm"
          disabled={flattening || pageCount < 1}
          onClick={() => onFlatten()}
        >
          {flattening ? "Flattening…" : "Flatten PDF"}
        </Button>
      </div>

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Export pages as images</Text>
        <div className="flex gap-2">
          {(["png", "jpeg"] as const).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={exportFormat === f ? "primary" : "outline"}
              onClick={() => setExportFormat(f)}
            >
              {f.toUpperCase()}
            </Button>
          ))}
          {[72, 150, 300].map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={exportDpi === d ? "primary" : "outline"}
              onClick={() => setExportDpi(d)}
            >
              {d}dpi
            </Button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={exporting || pageCount < 1}
          onClick={() =>
            onExportImages({ format: exportFormat, dpi: exportDpi })
          }
        >
          {exporting ? "Exporting…" : "Export images ZIP"}
        </Button>
        {imagesDownloadUrl ? (
          <a
            href={imagesDownloadUrl}
            target="_blank"
            rel="noreferrer"
            className="text-kumo-default block text-xs underline"
          >
            Download images ZIP
          </a>
        ) : null}
      </div>

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Convert to Office</Text>
        <Text variant="secondary" size="xs">Export as Word, Excel, or PowerPoint. Layout-locked — text boxes, not
          flowing prose.</Text>
        <div className="flex gap-2">
          {(["docx", "xlsx", "pptx"] as const).map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={officeFormat === f ? "primary" : "outline"}
              onClick={() => setOfficeFormat(f)}
            >
              {f.toUpperCase()}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={officing || pageCount < 1}
          onClick={() => onToOffice({ format: officeFormat })}
        >
          {officing
            ? "Converting…"
            : `Convert to ${officeFormat.toUpperCase()}`}
        </Button>
        {officeDownloadUrl ? (
          <a
            href={officeDownloadUrl}
            target="_blank"
            rel="noreferrer"
            className="text-kumo-default block text-xs underline"
          >
            Download {officeFormat.toUpperCase()}
          </a>
        ) : null}
      </div>

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Make searchable (OCR)</Text>
        <Text variant="secondary" size="xs">Add a text layer to scanned pages — existing text is preserved.</Text>
        <Input
          label="Language"
          value={ocrLang}
          onChange={(e) => setOcrLang(e.target.value)}
          placeholder="eng"
          maxLength={20}
        />
        <Button
          type="button"
          size="sm"
          disabled={
            ocred ||
            pageCount < 1 ||
            !/^[a-z]{3}(\+[a-z]{3})*$/.test(ocrLang.trim())
          }
          onClick={() => onOcr({ lang: ocrLang.trim() })}
        >
          {ocred ? "Running OCR…" : "Run OCR"}
        </Button>
      </div>

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Compare with another draft</Text>
        <Text variant="secondary" size="xs">Text-level diff — lists lines added and removed per page.</Text>
        <Select
          value={compareTarget}
          onValueChange={(v) => setCompareTarget(v ?? "")}
          placeholder="Choose a draft…"
        >
          {mergeCandidates.map((d) => (
            <Select.Option key={d.publicId} value={d.publicId}>
              {d.name}
            </Select.Option>
          ))}
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={comparing || !compareTarget}
          onClick={() => onCompare({ withPublicId: compareTarget })}
        >
          {comparing ? "Comparing…" : "Compare"}
        </Button>
        {compareResult ? (
          <div className="bg-kumo-elevated max-h-64 space-y-2 overflow-y-auto rounded-md p-2 text-xs">
            <Text as="p" bold>{compareResult.pagesDifferent === 0
                ? "Identical text — no differences."
                : `${compareResult.pagesDifferent} page(s) differ: +${compareResult.linesAdded} −${compareResult.linesRemoved} lines`}</Text>
            {compareResult.pages.map((p) => (
              <div key={p.page} className="space-y-0.5">
                <Text as="p" variant="secondary">Page {p.page}</Text>
                {p.removed.map((l, i) => (
                  <p key={`r${i}`} className="text-kumo-danger truncate">
                    − {l}
                  </p>
                ))}
                {p.added.map((l, i) => (
                  <p key={`a${i}`} className="text-kumo-success truncate">
                    + {l}
                  </p>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Archival format (PDF/A)</Text>
        <Text variant="secondary" size="xs">Convert to a long-term-archival PDF/A flavour — replaces the stored
          PDF.</Text>
        <Select
          value={pdfaFormat}
          onValueChange={(v) =>
            setPdfaFormat((v ?? "PDF/A-2b") as typeof pdfaFormat)
          }
          placeholder="PDF/A flavour"
        >
          {(["PDF/A-1b", "PDF/A-2b", "PDF/A-3b"] as const).map((f) => (
            <Select.Option key={f} value={f}>
              {f}
            </Select.Option>
          ))}
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pdfaing || pageCount < 1}
          onClick={() => onToPdfa({ format: pdfaFormat })}
        >
          {pdfaing ? "Converting…" : "Convert to PDF/A"}
        </Button>
      </div>

      <div className="border-kumo-line space-y-2 border-t pt-4">
        <Text size="xs">Combine with another draft</Text>
        <Text variant="secondary" size="xs">Append other draft PDFs after this one into a new draft.</Text>
        {mergeCandidates.length === 0 ? (
          <Text variant="secondary" size="xs">No other draft documents available.</Text>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {mergeCandidates.map((doc) => {
              const checked = selectedMergeIds.includes(doc.publicId);
              return (
                <li key={doc.publicId}>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleMergeId(doc.publicId)}
                    label={doc.name}
                  />
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
