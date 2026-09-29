import type { JSX } from "react";

import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo";

export interface SigningInviteGateProps {
  documentTitle: string;
  invitedBy?: string;
  email: string;
  onEmailChange?: (email: string) => void;
  onStart: () => void;
  isStarting?: boolean;
  brandName?: string;
  /** When true, email is display-only (token already identifies the signer). */
  emailReadOnly?: boolean;
}

/**
 * DocuSeal-style invite gate: title · invited-by · email · START.
 * Fluid width — follows the viewport, no fixed pixel shell.
 */
export function SigningInviteGate({
  documentTitle,
  invitedBy,
  email,
  onEmailChange,
  onStart,
  isStarting = false,
  brandName = "Seal",
  emailReadOnly = false,
}: SigningInviteGateProps): JSX.Element {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center space-y-6 px-[max(1rem,env(safe-area-inset-left))] py-8 pr-[max(1rem,env(safe-area-inset-right))]">
      <div className="space-y-3 text-center">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          {brandName}
        </p>
        <p className="text-2xl font-semibold tracking-tight text-balance">
          You have been invited to sign
        </p>
      </div>
      <div className="bg-muted/40 flex w-full items-center rounded-xl p-[clamp(0.75rem,3vw,1.25rem)]">
        <div className="min-w-0">
          <p className="mb-1 text-lg font-bold text-balance">{documentTitle}</p>
          {invitedBy ? (
            <p className="text-muted-foreground text-sm text-pretty">
              Invited by {invitedBy}
            </p>
          ) : null}
        </div>
      </div>
      <div className="w-full space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange?.(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          readOnly={emailReadOnly}
          disabled={emailReadOnly}
        />
        <Button
          type="button"
          className="min-h-12 w-full text-base"
          onClick={onStart}
          disabled={isStarting || !email.trim()}
        >
          {isStarting ? "Starting…" : "Start"}
        </Button>
      </div>
    </main>
  );
}
