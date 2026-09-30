/**
 * Public Document Verification Page — upload mode.
 * Route: /verify
 *
 * Anyone holding a sealed PDF can drop it here; the API SHA-256s the bytes
 * and matches them against completed documents' documentHash. The hash is
 * the capability — no login required.
 */

import { Button } from "@cloudflare/kumo/components/button";
import { createFileRoute } from "@tanstack/react-router";
import { FileUpIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import {
  VerifyFailed,
  VerifyPageShell,
  VerifySuccess,
} from "@/components/verify-card";
import {
  verifyDocumentByUpload,
  type VerifyDocumentResult,
} from "@/lib/api-client";
import {
  muteGuestAnalytics,
  useGuestAnalyticsMute,
} from "@/lib/guest-analytics";

export const Route = createFileRoute("/verify/")({
  beforeLoad: () => {
    muteGuestAnalytics();
  },
  component: VerifyUploadPage,
});

function VerifyUploadPage() {
  useGuestAnalyticsMute();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerifyDocumentResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const verify = useCallback(async (file: File) => {
    if (file.size === 0 || file.size > 50 * 1024 * 1024) {
      setFailed("File must be a PDF under 50 MB.");
      return;
    }
    setVerifying(true);
    setFailed(null);
    try {
      const bytes = await file.arrayBuffer();
      const res = await verifyDocumentByUpload(bytes);
      if (!res.verified) {
        setFailed(
          "This document does not match any completed Seal document — it may have been altered or was not sealed here."
        );
        return;
      }
      setResult(res);
    } catch {
      setFailed("Could not verify this file — upload a signed PDF.");
    } finally {
      setVerifying(false);
    }
  }, []);

  if (result) return <VerifySuccess result={result} />;
  if (failed) {
    return (
      <>
        <VerifyFailed message={failed} />
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setFailed(null)}
          >
            Try another file
          </Button>
        </div>
      </>
    );
  }

  return (
    <VerifyPageShell>
      <div className="border-border bg-card rounded-xl border p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <div className="bg-muted flex h-14 w-14 items-center justify-center rounded-full">
            <FileUpIcon className="text-muted-foreground h-7 w-7" />
          </div>
        </div>
        <h1 className="text-foreground mb-2 text-xl font-semibold">
          Verify a signed document
        </h1>
        <p className="text-muted-foreground mb-6 text-sm">
          Upload a completed Seal PDF — its contents are hashed and checked
          against the recorded document fingerprint. Altered files fail.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void verify(file);
          }}
        />
        <div
          role="button"
          tabIndex={0}
          className="border-border hover:border-foreground/30 cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void verify(file);
          }}
        >
          <p className="text-foreground text-sm font-medium">
            {verifying ? "Verifying…" : "Drop a PDF here or click to browse"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            PDF only · up to 50 MB
          </p>
        </div>
      </div>

      <p className="text-muted-foreground mt-8 text-center text-xs">
        Verified by{" "}
        <a href="https://seal.nyc" className="underline underline-offset-2">
          Seal
        </a>{" "}
        — Document Signing Platform
      </p>
    </VerifyPageShell>
  );
}
