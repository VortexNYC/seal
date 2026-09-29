import { buttonVariants } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { IdentificationCard } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useEffect, type ReactElement } from "react";

import { useCurrentUser } from "@/hooks/use-current-user";
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
      <div className="flex min-h-dvh w-full items-center justify-center px-[max(1rem,env(safe-area-inset-left))] py-[max(1rem,env(safe-area-inset-bottom))]">
        <p className="text-muted-foreground text-sm">Checking your account…</p>
      </div>
    );
  }

  if (emailMatches) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center px-4">
        <p className="text-muted-foreground text-sm">Continuing…</p>
      </div>
    );
  }

  const wrongAccount =
    isSignedIn &&
    !!user?.primaryEmailAddress?.emailAddress &&
    !emailMatches;

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-[max(1rem,env(safe-area-inset-left))] py-8 pr-[max(1rem,env(safe-area-inset-right))]">
      <LayerCard className="w-full max-w-lg p-[clamp(1rem,4vw,2rem)]">
        <div className="mb-4 flex items-center gap-2">
          <IdentificationCard className="size-6 shrink-0" weight="duotone" />
          <h1 className="text-xl font-semibold tracking-tight text-balance">
            Confirm who you are
          </h1>
        </div>
        <p className="text-muted-foreground mb-2 text-sm text-pretty">
          Create a free Seal account (or sign in) with{" "}
          <span className="text-foreground font-medium">{recipientEmail}</span>{" "}
          so this signing action is tied to a verified identity for the audit
          trail.
        </p>
        {wrongAccount ? (
          <p className="text-kumo-warning mb-6 text-sm text-pretty">
            You&apos;re signed in as{" "}
            {user?.primaryEmailAddress?.emailAddress ?? "another account"}. Sign
            out and use the invited email, or switch accounts.
          </p>
        ) : (
          <p className="text-muted-foreground mb-6 text-sm text-pretty">
            Takes under a minute. Same email as the invitation.
          </p>
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
        </div>
      </LayerCard>
    </div>
  );
}
