import { Text } from "@cloudflare/kumo/components/text";
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
      className="bg-kumo-canvas px-safe mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 py-8"
    >
      <div className="flex flex-col gap-2 text-center">
        <Text as="p" variant="secondary" size="sm" DANGEROUS_className="m-0">{brandName}</Text>
        <Text as="h1" variant="heading" DANGEROUS_className="m-0">You&apos;re invited to sign</Text>
        <Text as="p" variant="secondary" size="sm" DANGEROUS_className="m-0">Review the document, fill any required fields, then sign. Takes a
          minute.</Text>
      </div>

      <div className="border-kumo-line bg-kumo-base p-fluid-sm flex w-full flex-col gap-1 rounded-xl border shadow-sm">
        <Text as="p" bold DANGEROUS_className="m-0">{documentTitle}</Text>
        {invitedBy ? (
          <Text as="p" variant="secondary" size="sm" DANGEROUS_className="m-0">From {invitedBy}</Text>
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
          size="lg"
          className="w-full"
          onClick={onStart}
          disabled={isStarting || !email.trim()}
        >
          {isStarting ? "Opening…" : "Continue to document"}
        </Button>
      </div>
    </main>
  );
}
