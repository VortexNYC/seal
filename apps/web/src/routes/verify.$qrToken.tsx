/**
 * Public Document Verification Page
 * Route: /verify/$qrToken
 *
 * Anyone can scan the QR code on a completion certificate and land here
 * to verify the document is authentic. No login required.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2Icon, CopyIcon, ShieldXIcon } from "lucide-react";
import { useState } from "react";

import {
  verifyDocumentByQrToken,
  type VerifyDocumentResult,
} from "@/lib/api-client";

export const Route = createFileRoute("/verify/$qrToken")({
  component: VerifyPage,
});

function VerifyPage() {
  const { qrToken } = Route.useParams();
  const { data: result } = useSuspenseQuery({
    queryKey: ["verify", qrToken],
    queryFn: () => verifyDocumentByQrToken(qrToken),
  });

  if (!result) {
    return <VerifyFailed />;
  }

  return <VerifySuccess result={result} />;
}

function VerifySuccess({ result }: { result: VerifyDocumentResult }) {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-10 text-center">
          <span className="text-foreground text-2xl font-bold tracking-tight">
            Seal
          </span>
        </div>

        {/* Verified card */}
        <div className="border-border bg-card rounded-xl border p-8 shadow-sm">
          {/* Status */}
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="bg-success-surface flex h-14 w-14 items-center justify-center rounded-full">
              <CheckCircle2Icon className="text-success h-7 w-7" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                Document Verified
              </p>
              <h1 className="text-foreground mt-1 text-xl font-semibold">
                {result.documentName}
              </h1>
            </div>
            {result.completedAt && (
              <p className="text-muted-foreground text-sm">
                Completed on{" "}
                {new Date(result.completedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </p>
            )}
          </div>

          <div className="border-border border-t pt-6">
            {/* Signers */}
            <h2 className="text-foreground mb-3 text-sm font-semibold">
              Signers ({result.signerCount})
            </h2>
            <div className="space-y-3">
              {result.signers.map((signer, i) => (
                <div key={i} className="bg-muted/50 rounded-lg px-4 py-3">
                  <p className="text-foreground text-sm font-medium">
                    {signer.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {signer.maskedEmail}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-muted-foreground text-xs capitalize">
                      {signer.role}
                    </span>
                    {signer.signedAt && (
                      <>
                        <span className="text-muted-foreground text-xs">·</span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(signer.signedAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              timeZone: "UTC",
                            }
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Document Hash */}
          {result.documentHash && (
            <div className="border-border mt-6 border-t pt-6">
              <h2 className="text-foreground mb-2 text-sm font-semibold">
                Document Integrity
              </h2>
              <p className="text-muted-foreground mb-2 text-xs">
                SHA-256 hash of the original document. Compare this with your
                copy to verify it has not been altered.
              </p>
              <HashField hash={result.documentHash} />
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-muted-foreground mt-8 text-center text-xs">
          Verified by{" "}
          <a href="https://seal.so" className="underline underline-offset-2">
            Seal
          </a>{" "}
          — Document Signing Platform
        </p>
      </div>
    </div>
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
    <div className="border-border bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2">
      <code className="text-foreground min-w-0 flex-1 truncate font-mono text-xs">
        {hash}
      </code>
      <button
        onClick={copy}
        className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
        aria-label="Copy hash"
      >
        {copied ? (
          <span className="text-success text-xs">Copied</span>
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function VerifyFailed() {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center px-4 py-16">
      <div className="w-full max-w-lg">
        <div className="mb-10 text-center">
          <span className="text-foreground text-2xl font-bold tracking-tight">
            Seal
          </span>
        </div>

        <div className="border-border bg-card rounded-xl border p-8 text-center shadow-sm">
          <div className="mb-4 flex justify-center">
            <div className="bg-destructive/10 flex h-14 w-14 items-center justify-center rounded-full">
              <ShieldXIcon className="text-destructive h-7 w-7" />
            </div>
          </div>
          <h1 className="text-foreground mb-2 text-xl font-semibold">
            Verification Failed
          </h1>
          <p className="text-muted-foreground text-sm">
            This verification link is invalid or the document no longer exists.
          </p>
          <a
            href="https://seal.so"
            className="text-muted-foreground hover:text-foreground mt-6 inline-block text-sm underline underline-offset-2"
          >
            Go to Seal
          </a>
        </div>
      </div>
    </div>
  );
}
