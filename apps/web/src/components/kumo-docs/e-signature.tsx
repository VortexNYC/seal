import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Select } from "@cloudflare/kumo/components/select";
import { Tabs } from "@cloudflare/kumo/components/tabs";

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
  const enabled = METHOD_ORDER.filter((method) => methods.includes(method));
  const [method, setMethod] = useState<ESignatureMethod>(
    enabled[0] ?? "drawn"
  );
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
    let rafId = 0;
    const onResize = (): void => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateWidth);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

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
    ctx.textBaseline = "middle";
    const textWidth = ctx.measureText(name).width;
    const x = Math.max(10, (canvas.width - textWidth) / 2);
    ctx.fillText(name, x, 60);
    return canvas.toDataURL("image/png");
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
    emitPending({
      method: "drawn",
      dataUrl: canvas.toDataURL("image/png"),
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

  function submitDrawn(): void {
    const canvas = canvasRef.current;
    if (!canvas || canvas.isEmpty()) return;
    const result: ESignatureResult = {
      method: "drawn",
      dataUrl: canvas.getTrimmedCanvas().toDataURL("image/png"),
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
      if (typeof reader.result !== "string") return;
      setUploadedImage(reader.result);
      emitPending({ method: "uploaded", dataUrl: reader.result });
      if (showActions) submitUpload(reader.result);
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
              ref={(ref) => {
                canvasRef.current = ref;
              }}
              canvasProps={{
                className:
                  "h-[200px] w-full cursor-crosshair touch-none select-none",
                width: canvasWidth,
                height: 200,
                style: { touchAction: "none" },
              }}
              // vortex-allow-color: signature capture pad represents white paper in both themes
              backgroundColor="rgb(255, 255, 255)"
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
          <Label htmlFor="esign-typed">Type your full name</Label>
          <Input
            id="esign-typed"
            value={typedName}
            onChange={(e) => {
              setTypedName(e.target.value);
              syncTypedPending(e.target.value);
            }}
            placeholder="John Doe"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="done"
            aria-label="Type your full name"
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
                className="mx-auto max-h-[200px]"
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
