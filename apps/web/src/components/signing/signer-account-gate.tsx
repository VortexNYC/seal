import { Text } from "@cloudflare/kumo/components/text";
import { buttonVariants } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { IdentificationCard } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactElement } from "react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { submitPublicSigning } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function SignerAccountGate({
  token,
  recipientEmail,
  onReady,
}: {
  token: string;
  recipientEmail: string;
  onReady: () => void;
}): ReactElement {
  const { user, isLoaded, isSignedIn } = useCurrentUser();
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [declineError, setDeclineError] = useState<string | null>(null);
  const returnPath = `/sign/${encodeURIComponent(token)}`;
  const emailMatches =
    isSignedIn &&
    !!user?.primaryEmailAddress?.emailAddress &&
    user.primaryEmailAddress.emailAddress.toLowerCase() ===
      recipientEmail.toLowerCase();

  useEffect(() => {
    if (isLoaded && emailMatches) {
      onReady();
    }
  }, [emailMatches, isLoaded, onReady]);

  if (!isLoaded) {
    return (
      <div className="px-safe py-safe flex min-h-dvh w-full items-center justify-center">
        <Text as="p" variant="secondary" size="sm">Checking your account…</Text>
      </div>
    );
  }

  if (emailMatches) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center px-4">
        <Text as="p" variant="secondary" size="sm">Continuing…</Text>
      </div>
    );
  }

  const wrongAccount =
    isSignedIn && !!user?.primaryEmailAddress?.emailAddress && !emailMatches;

  return (
    <div className="px-safe flex min-h-dvh w-full items-center justify-center py-8">
      <LayerCard className="p-fluid w-full max-w-lg">
        <div className="mb-4 flex items-center gap-2">
          <IdentificationCard className="size-6 shrink-0" weight="duotone" />
          <Text as="h1" variant="heading">Confirm who you are</Text>
        </div>
        <p className="text-kumo-secondary mb-2 text-sm text-pretty">
          Create a free Seal account (or sign in) with{" "}
          <span className="text-kumo-default font-medium">{recipientEmail}</span>{" "}
          so this signing action is tied to a verified identity for the audit
          trail.
        </p>
        {wrongAccount ? (
          <Text as="p" size="sm" DANGEROUS_className="mb-6">You&apos;re signed in as{" "}
            {user?.primaryEmailAddress?.emailAddress ?? "another account"}. Sign
            out and use the invited email, or switch accounts.</Text>
        ) : (
          <Text as="p" variant="secondary" size="sm" DANGEROUS_className="mb-6">Takes under a minute. Same email as the invitation.</Text>
        )}

        <div className="flex w-full flex-col gap-3">
          <Link
            to="/sign-up"
            search={{ redirect: returnPath }}
            className={cn(
              buttonVariants({ variant: "primary" }),
              "flex min-h-12 w-full items-center justify-center text-base"
            )}
            data-testid="signer-account-sign-up"
          >
            Create account
          </Link>
          <Link
            to="/sign-in"
            search={{ redirect: returnPath }}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "flex min-h-12 w-full items-center justify-center text-base"
            )}
            data-testid="signer-account-sign-in"
          >
            Sign in
          </Link>
          <button
            type="button"
            className={cn(
              buttonVariants({
                variant: confirmDecline ? "destructive" : "outline",
              }),
              "flex min-h-12 w-full items-center justify-center text-base"
            )}
            data-testid="signer-account-decline"
            onClick={() => {
              if (!confirmDecline) {
                setConfirmDecline(true);
                return;
              }
              void submitPublicSigning(token, {
                status: "declined",
                declineReason: "Declined",
                ipAddress: "",
                userAgent: navigator.userAgent,
              })
                .then(() => {
                  window.location.reload();
                })
                .catch((error: unknown) => {
                  setDeclineError(
                    error instanceof Error
                      ? error.message
                      : "Could not decline this document"
                  );
                });
            }}
          >
            {confirmDecline ? "Decline this document" : "Decline to sign"}
          </button>
          {declineError ? (
            <Text as="p" variant="error" size="sm">{declineError}</Text>
          ) : null}
        </div>
      </LayerCard>
    </div>
  );
}
