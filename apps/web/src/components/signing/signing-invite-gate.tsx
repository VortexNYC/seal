import { Input } from "@cloudflare/kumo";
import { Button } from "@cloudflare/kumo/components/button";
import type { JSX } from "react";

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
 * Invite gate — same visual family as SigningShell (brand → title → one CTA).
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
    <main
      data-seal-enter
      className="bg-background px-safe mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 py-8"
    >
      <div className="flex flex-col gap-2 text-center">
        <p className="text-muted-foreground m-0 text-sm font-medium tracking-wide uppercase">
          {brandName}
        </p>
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-balance">
          You&apos;re invited to sign
        </h1>
        <p className="text-muted-foreground m-0 text-sm text-pretty">
          Review the document, fill any required fields, then sign. Takes a
          minute.
        </p>
      </div>

      <div className="border-border bg-card p-fluid-sm flex w-full flex-col gap-1 rounded-xl border shadow-sm">
        <p className="m-0 text-lg font-semibold text-balance">
          {documentTitle}
        </p>
        {invitedBy ? (
          <p className="text-muted-foreground m-0 text-sm text-pretty">
            From {invitedBy}
          </p>
        ) : null}
      </div>

      <div className="flex w-full flex-col gap-4">
        <Input
          label="Signing as"
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
          variant="primary"
          className="min-h-12 w-full text-base font-semibold"
          onClick={onStart}
          disabled={isStarting || !email.trim()}
        >
          {isStarting ? "Opening…" : "Continue to document"}
        </Button>
      </div>
    </main>
  );
}
