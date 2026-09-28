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
 * Kumo chrome only — no sidebar, no activity.
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
    <main className="mx-auto mt-12 mb-4 max-w-md space-y-6 px-2">
      <div className="space-y-6 text-center">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          {brandName}
        </p>
        <p className="text-xl font-semibold">You have been invited to sign</p>
      </div>
      <div className="bg-muted/40 flex items-center rounded-xl p-4">
        <div>
          <p className="mb-1 text-lg font-bold">{documentTitle}</p>
          {invitedBy ? (
            <p className="text-muted-foreground text-sm">
              Invited by {invitedBy}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-4">
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
          className="w-full"
          onClick={onStart}
          disabled={isStarting || !email.trim()}
        >
          {isStarting ? "Starting…" : "Start"}
        </Button>
      </div>
    </main>
  );
}
