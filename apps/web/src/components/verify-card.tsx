/**
 * Shared verification page chrome — used by both the QR-token page
 * (/verify/$qrToken) and the upload page (/verify). Public, no auth.
 */

import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Link } from "@cloudflare/kumo/components/link";
import { CheckCircle as CheckCircle2Icon, Copy as CopyIcon, ShieldSlash as ShieldXIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { SealLogo } from "@/components/seal-logo";
import type { VerifyDocumentResult } from "@/lib/api-client";

export function VerifyPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-kumo-canvas flex min-h-dvh flex-col items-center px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <SealLogo size={40} variant="color" />
          <span className="text-kumo-default font-serif text-2xl tracking-tight">
            Seal
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function VerifySuccess({ result }: { result: VerifyDocumentResult }) {
  return (
    <VerifyPageShell>
      <LayerCard className="p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="bg-kumo-success-tint flex h-14 w-14 items-center justify-center rounded-full">
            <CheckCircle2Icon className="text-kumo-success h-7 w-7" />
          </div>
          <div>
            <Text as="p" variant="secondary" size="xs">Document Verified</Text>
            <Text as="h1" variant="heading" DANGEROUS_className="mt-1">{result.documentName}</Text>
          </div>
          {result.completedAt && (
            <Text as="p" variant="secondary" size="sm">Completed on{" "}
              {new Date(result.completedAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}</Text>
          )}
        </div>

        <div className="border-kumo-line border-t pt-6">
          <Text as="h2" variant="heading" DANGEROUS_className="mb-3">Signers ({result.signerCount})</Text>
          <div className="space-y-3">
            {result.signers.map((signer, i) => (
              <div key={i} className="bg-kumo-elevated/50 rounded-lg px-4 py-3">
                <Text as="p" size="sm" bold>{signer.name}</Text>
                <Text as="p" variant="secondary" size="xs">{signer.maskedEmail}</Text>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-kumo-secondary text-xs capitalize">
                    {signer.role}
                  </span>
                  {signer.signedAt && (
                    <>
                      <span className="text-kumo-secondary text-xs">·</span>
                      <span className="text-kumo-secondary text-xs">
                        {new Date(signer.signedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {result.documentHash && (
          <div className="border-kumo-line mt-6 border-t pt-6">
            <Text as="h2" variant="heading" DANGEROUS_className="mb-2">Document Integrity</Text>
            <Text as="p" variant="secondary" size="xs" DANGEROUS_className="mb-2">SHA-256 hash of the signed document. Compare this with your copy
              to verify it has not been altered.</Text>
            <HashField hash={result.documentHash} />
          </div>
        )}
      </LayerCard>

      <Text variant="secondary" size="xs" DANGEROUS_className="mt-8 text-center">
        Verified by <Link href="https://seal.nyc">Seal</Link> — Document
        Signing Platform
      </Text>
    </VerifyPageShell>
  );
}

export function VerifyFailed({ message }: { message?: string }) {
  return (
    <VerifyPageShell>
      <LayerCard className="p-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="bg-kumo-danger/10 flex h-14 w-14 items-center justify-center rounded-full">
            <ShieldXIcon className="text-kumo-danger h-7 w-7" />
          </div>
        </div>
        <Text as="h1" variant="heading" DANGEROUS_className="mb-2">Verification Failed</Text>
        <Text as="p" variant="secondary" size="sm">{message ??
            "This verification link is invalid or the document no longer exists."}</Text>
        <Link href="https://seal.nyc">Go to Seal</Link>
      </LayerCard>
    </VerifyPageShell>
  );
}

function HashField({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-kumo-line bg-kumo-elevated/50 flex items-center gap-2 rounded-lg border px-3 py-2">
      <code className="text-kumo-default min-w-0 flex-1 truncate font-mono text-xs">
        {hash}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        shape="square"
        icon={copied ? undefined : CopyIcon}
        onClick={() => void copy()}
        aria-label="Copy hash"
      >
        {copied ? "Copied" : null}
      </Button>
    </div>
  );
}
