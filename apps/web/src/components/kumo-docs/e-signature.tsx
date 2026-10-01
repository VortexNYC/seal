import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Select } from "@cloudflare/kumo/components/select";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

import {
  cropTransparentCanvas,
  cropTransparentDataUrl,
} from "@/lib/crop-transparent-canvas";
import { parseSelectValue } from "@/lib/select-values";
import { cn } from "@/lib/utils";

export type ESignatureMethod = "drawn" | "typed" | "uploaded";

export type ESignatureFont = {
  name: string;
  value: string;
  cssFamily: string;
};

export type ESignatureResult = {
  method: ESignatureMethod;
  dataUrl: string;
  typedName?: string;
};

export type ESignatureProps = {
  className?: string;
  methods?: ESignatureMethod[];
  /** Override tab labels (product uses Draw / Type / Upload). */
  methodLabels?: Partial<Record<ESignatureMethod, string>>;
  defaultTypedName?: string;
  fonts?: readonly ESignatureFont[];
  /** When false, parent owns confirm — listen via onPendingChange. */
  showActions?: boolean;
  showTabs?: boolean;
  onComplete?: (result: ESignatureResult) => void;
  onPendingChange?: (pending: ESignatureResult | null) => void;
  onCancel?: () => void;
};

const DEFAULT_FONTS: readonly ESignatureFont[] = [
  {
    name: "Dancing Script",
    value: "dancing-script",
    cssFamily: "'Dancing Script', cursive",
  },
  {
    name: "Great Vibes",
    value: "great-vibes",
    cssFamily: "'Great Vibes', cursive",
  },
  { name: "Pacifico", value: "pacifico", cssFamily: "'Pacifico', cursive" },
  { name: "Caveat", value: "caveat", cssFamily: "'Caveat', cursive" },
  {
    name: "Sacramento",
    value: "sacramento",
    cssFamily: "'Sacramento', cursive",
  },
] as const;

const SIGNATURE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Pacifico&family=Sacramento&display=swap";

const SIGNATURE_FONTS_LINK_ID = "seal-signature-fonts";

/** SEA-88: load typed-signature fonts only when capture UI mounts — not on auth. */
function ensureSignatureFontsLoaded(): void {
  if (typeof document === "undefined") {
    return;
  }
  if (document.getElementById(SIGNATURE_FONTS_LINK_ID)) {
    return;
  }
  const link = document.createElement("link");
  link.id = SIGNATURE_FONTS_LINK_ID;
  link.rel = "stylesheet";
  link.href = SIGNATURE_FONTS_HREF;
  document.head.appendChild(link);
}

const METHOD_ORDER: readonly ESignatureMethod[] = [
  "drawn",
  "typed",
  "uploaded",
];

/**
 * E-signature capture — Extend e-signature capability on Kumo + seal canvas.
 */
export function ESignature({
  className,
  methods = ["drawn", "typed", "uploaded"],
  methodLabels,
  defaultTypedName = "",
  fonts = DEFAULT_FONTS,
  showActions = true,
  showTabs = true,
  onComplete,
  onPendingChange,
  onCancel,
}: ESignatureProps): JSX.Element {
  useEffect(() => {
    ensureSignatureFontsLoaded();
  }, []);

  const enabled = METHOD_ORDER.filter((method) => methods.includes(method));
  const [method, setMethod] = useState<ESignatureMethod>(enabled[0] ?? "drawn");
  const [typedName, setTypedName] = useState(defaultTypedName);
  const [selectedFont, setSelectedFont] = useState(fonts[0]?.value ?? "");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const canvasRef = useRef<SignatureCanvas | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

  const fontValues = fonts.map((font) => font.value);
  const currentFontFamily =
    fonts.find((font) => font.value === selectedFont)?.cssFamily ??
    fonts[0]?.cssFamily ??
    "'Hedvig Letters Serif', Georgia, serif";

  useEffect(() => {
    const updateWidth = (): void => {
      if (!canvasContainerRef.current) return;
      const width = canvasContainerRef.current.offsetWidth - 4;
      setCanvasWidth(Math.max(280, Math.min(600, width)));
    };
    updateWidth();
    const node = canvasContainerRef.current;
    const observer =
      typeof ResizeObserver !== "undefined" && node
        ? new ResizeObserver(() => {
            updateWidth();
          })
        : null;
    if (node && observer) observer.observe(node);
    let rafId = 0;
    const onResize = (): void => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateWidth);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [method]);

  useEffect(() => {
    setTypedName(defaultTypedName);
  }, [defaultTypedName]);

  function labelFor(value: ESignatureMethod): string {
    return (
      methodLabels?.[value] ??
      (value === "drawn"
        ? "Draw"
        : value === "typed"
          ? "Type"
          : value === "uploaded"
            ? "Upload"
            : value)
    );
  }

  const tabs = enabled.map((value) => ({
    value,
    label: labelFor(value),
  }));

  function buildTypedDataUrl(name: string): string | null {
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // vortex-allow-color: Canvas signature rendering requires a concrete ink color.
    ctx.fillStyle = "#000000";
    ctx.font = `52px ${currentFontFamily}`;
    // alphabetic baseline near bottom — DocuSeal find_trim then burn bottom-aligns.
    ctx.textBaseline = "alphabetic";
    const textWidth = ctx.measureText(name).width;
    const x = Math.max(10, (canvas.width - textWidth) / 2);
    ctx.fillText(name, x, canvas.height - 8);
    return cropTransparentCanvas(canvas).toDataURL("image/png");
  }

  function emitPending(next: ESignatureResult | null): void {
    onPendingChange?.(next);
  }

  function syncDrawnPending(): void {
    const canvas = canvasRef.current;
    if (!canvas || canvas.isEmpty()) {
      emitPending(null);
      return;
    }
    // Match submitDrawn: trim transparent pad so burn-in sits on the line.
    const trimmed = canvas.getTrimmedCanvas();
    emitPending({
      method: "drawn",
      dataUrl: cropTransparentCanvas(trimmed).toDataURL("image/png"),
    });
  }

  function syncTypedPending(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) {
      emitPending(null);
      return;
    }
    const dataUrl = buildTypedDataUrl(trimmed);
    if (!dataUrl) {
      emitPending(null);
      return;
    }
    emitPending({ method: "typed", dataUrl, typedName: trimmed });
  }

  // Type tab shows a live preview from typedName; Accept needs the pending
  // data URL even when the name came from defaultTypedName without keystrokes.
  useEffect(() => {
    if (method !== "typed") return;
    syncTypedPending(typedName);
  }, [method, typedName, selectedFont, currentFontFamily]);

  function submitDrawn(): void {
    const canvas = canvasRef.current;
    if (!canvas || canvas.isEmpty()) return;
    const trimmed = canvas.getTrimmedCanvas();
    const result: ESignatureResult = {
      method: "drawn",
      dataUrl: cropTransparentCanvas(trimmed).toDataURL("image/png"),
    };
    onComplete?.(result);
  }

  function submitTyped(): void {
    const trimmed = typedName.trim();
    if (!trimmed) return;
    const dataUrl = buildTypedDataUrl(trimmed);
    if (!dataUrl) return;
    onComplete?.({ method: "typed", dataUrl, typedName: trimmed });
  }

  function submitUpload(dataUrl: string): void {
    onComplete?.({ method: "uploaded", dataUrl });
  }

  function handleUploadFile(file: File): void {
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        if (typeof reader.result !== "string") return;
        const cropped = await cropTransparentDataUrl(reader.result);
        setUploadedImage(cropped);
        emitPending({ method: "uploaded", dataUrl: cropped });
        if (showActions) submitUpload(cropped);
      })();
    };
    reader.readAsDataURL(file);
  }

  return (
    <div data-kumo-docs="e-signature" className={cn("space-y-4", className)}>
      {showTabs && tabs.length > 1 ? (
        <Tabs
          tabs={tabs}
          value={method}
          onValueChange={(value) => {
            if (
              value === "drawn" ||
              value === "typed" ||
              value === "uploaded"
            ) {
              setMethod(value);
              emitPending(null);
              setUploadedImage(null);
            }
          }}
        />
      ) : null}

      {method === "drawn" ? (
        <div className="space-y-2">
          <Label>Draw your signature</Label>
          <div
            ref={canvasContainerRef}
            // vortex-allow-color: signature capture pad represents white paper in both themes
            className="border-border overflow-hidden rounded-lg border-2 border-dashed bg-white"
          >
            <SignatureCanvas
              key={canvasWidth}
              ref={(ref) => {
                canvasRef.current = ref;
              }}
              canvasProps={{
                className:
                  "h-50 w-full cursor-crosshair touch-none select-none",
                width: canvasWidth,
                height: 200,
                style: { touchAction: "none" },
              }}
              // Transparent pad — DocuSeal crops alpha=0 so burn-in can bottom-align ink.
              // White paper look comes from the parent bg-white container.
              backgroundColor="rgba(0,0,0,0)"
              // vortex-allow-color: signature capture ink must stay physically black on white paper
              penColor="rgb(0, 0, 0)"
              onEnd={syncDrawnPending}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                canvasRef.current?.clear();
                emitPending(null);
              }}
            >
              Clear
            </Button>
            {showActions ? (
              <Button type="button" size="sm" onClick={submitDrawn}>
                Adopt signature
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">
            Use your mouse or finger to draw your signature above
          </p>
        </div>
      ) : null}

      {method === "typed" ? (
        <div className="space-y-2">
          <Input
            id="esign-typed"
            label="Type your full name"
            value={typedName}
            onChange={(e) => {
              setTypedName(e.target.value);
              syncTypedPending(e.target.value);
            }}
            placeholder="John Doe"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="done"
          />
          {fonts.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="esign-font">Select signature style</Label>
              <Select
                id="esign-font"
                value={selectedFont}
                onValueChange={(value) => {
                  const next =
                    parseSelectValue(value ?? "", fontValues) ?? selectedFont;
                  setSelectedFont(next);
                  syncTypedPending(typedName);
                }}
                placeholder="Select a font"
              >
                {fonts.map((font) => (
                  <Select.Option key={font.value} value={font.value}>
                    <span style={{ fontFamily: font.cssFamily }}>
                      {font.name}
                    </span>
                  </Select.Option>
                ))}
              </Select>
            </div>
          ) : null}
          <p
            // vortex-allow-color: signature preview represents white paper in both themes
            className="border-border overflow-hidden rounded-lg border-2 bg-white p-4 text-center text-3xl sm:p-8 sm:text-5xl"
            style={{ fontFamily: currentFontFamily }}
            aria-hidden
          >
            {typedName || "Your name"}
          </p>
          <p className="text-muted-foreground text-sm">
            Your typed name will be converted to a signature style using the
            selected font
          </p>
          {showActions ? (
            <Button type="button" size="sm" onClick={submitTyped}>
              Adopt signature
            </Button>
          ) : null}
        </div>
      ) : null}

      {method === "uploaded" ? (
        <div className="space-y-2">
          <Label htmlFor="esign-upload">Upload your signature image</Label>
          <input
            ref={fileRef}
            id="esign-upload"
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            className="border-border text-muted-foreground w-full rounded border bg-transparent p-2 text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadFile(file);
            }}
          />
          {uploadedImage ? (
            <div
              // vortex-allow-color: uploaded signature preview represents white paper in both themes
              className="border-border rounded-lg border-2 bg-white p-4"
            >
              <img
                src={uploadedImage}
                alt="Uploaded signature"
                className="mx-auto max-h-50"
              />
            </div>
          ) : null}
          <p className="text-muted-foreground text-sm">
            Upload a PNG or JPG image file (max 5MB)
          </p>
          {showActions ? (
            <Button
              type="button"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              Upload image
            </Button>
          ) : null}
        </div>
      ) : null}

      {showActions && onCancel ? (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}
