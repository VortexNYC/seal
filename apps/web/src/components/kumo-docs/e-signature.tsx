import type { JSX } from "react";
import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { Tabs } from "@cloudflare/kumo/components/tabs";

import { cn } from "@/lib/utils";

export type ESignatureMethod = "drawn" | "typed" | "uploaded";

export type ESignatureResult = {
  method: ESignatureMethod;
  dataUrl: string;
  typedName?: string;
};

export type ESignatureProps = {
  className?: string;
  methods?: ESignatureMethod[];
  onComplete: (result: ESignatureResult) => void;
  onCancel?: () => void;
};

/**
 * E-signature capture — Extend e-signature capability on Kumo + seal canvas.
 */
export function ESignature({
  className,
  methods = ["drawn", "typed", "uploaded"],
  onComplete,
  onCancel,
}: ESignatureProps): JSX.Element {
  const [method, setMethod] = useState<ESignatureMethod>(methods[0] ?? "drawn");
  const [typedName, setTypedName] = useState("");
  const canvasRef = useRef<SignatureCanvas | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const tabs = methods.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
  }));

  function submitDrawn(): void {
    const canvas = canvasRef.current;
    if (!canvas || canvas.isEmpty()) return;
    onComplete({
      method: "drawn",
      dataUrl: canvas.getTrimmedCanvas().toDataURL("image/png"),
    });
  }

  function submitTyped(): void {
    if (!typedName.trim()) return;
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0a0a0a";
    ctx.font = "48px 'Hedvig Letters Serif', Georgia, serif";
    ctx.fillText(typedName.trim(), 24, 96);
    onComplete({
      method: "typed",
      dataUrl: canvas.toDataURL("image/png"),
      typedName: typedName.trim(),
    });
  }

  function submitUpload(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onComplete({ method: "uploaded", dataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div
      data-kumo-docs="e-signature"
      className={cn("space-y-4", className)}
    >
      {tabs.length > 1 ? (
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
            }
          }}
        />
      ) : null}

      {method === "drawn" ? (
        <div className="space-y-2">
          <div className="border-border bg-white overflow-hidden rounded-lg border">
            <SignatureCanvas
              ref={(ref) => {
                canvasRef.current = ref;
              }}
              canvasProps={{
                className: "h-40 w-full",
                width: 600,
                height: 160,
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => canvasRef.current?.clear()}
            >
              Clear
            </Button>
            <Button type="button" size="sm" onClick={submitDrawn}>
              Adopt signature
            </Button>
          </div>
        </div>
      ) : null}

      {method === "typed" ? (
        <div className="space-y-2">
          <Label htmlFor="esign-typed">Full name</Label>
          <Input
            id="esign-typed"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your name"
          />
          <p
            className="border-border rounded-lg border bg-white px-4 py-6 font-serif text-3xl"
            aria-hidden
          >
            {typedName || "Your name"}
          </p>
          <Button type="button" size="sm" onClick={submitTyped}>
            Adopt signature
          </Button>
        </div>
      ) : null}

      {method === "uploaded" ? (
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) submitUpload(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            Upload image
          </Button>
        </div>
      ) : null}

      {onCancel ? (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}
