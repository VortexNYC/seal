/**
 * Public Document Verification Page — upload mode.
 * Route: /verify
 *
 * Anyone holding a sealed PDF can drop it here; the API SHA-256s the bytes
 * and matches them against completed documents' documentHash. The hash is
 * the capability — no login required.
 */

import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute } from "@tanstack/react-router";
import { FileArrowUp as FileUpIcon } from "@phosphor-icons/react";
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
      <LayerCard className="p-8 text-center">
        <div className="mb-4 flex justify-center">
          <FileUpIcon className="text-kumo-secondary h-7 w-7" />
        </div>
        <Text as="h1" variant="heading">
          Verify a signed document
        </Text>
        <Text variant="secondary" size="sm">
          Upload a completed Seal PDF — its contents are hashed and checked
          against the recorded document fingerprint. Altered files fail.
        </Text>
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
        <Button
          type="button"
          variant="outline"
          className="h-auto w-full flex-col py-10"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void verify(file);
          }}
        >
          {verifying ? "Verifying…" : "Drop a PDF here or click to browse"}
        </Button>
      </LayerCard>

      <Text variant="secondary" size="xs">
        Verified by{" "}
        <Link href="https://seal.nyc" target="_blank" rel="noreferrer">
          Seal
        </Link>{" "}
        — Document Signing Platform
      </Text>
    </VerifyPageShell>
  );
}
