import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { ShieldCheck, Spinner } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactElement } from "react";

import {
  challengePublicSigningAuth,
  verifyPublicSigningAuth,
} from "@/lib/api-client";
import { toast } from "@/lib/toast";

type AuthMethod = "access_code" | "email_otp";

export function SignerAuthGate({
  token,
  method,
  maskedEmail,
  onVerified,
}: {
  token: string;
  method: AuthMethod;
  maskedEmail: string | null;
  onVerified: () => void;
}): ReactElement {
  const [code, setCode] = useState("");
  const [challengeSent, setChallengeSent] = useState(method !== "email_otp");
  const autoChallengeStarted = useRef(false);

  const challengeMutation = useMutation({
    mutationFn: () => challengePublicSigningAuth(token),
    onSuccess: () => {
      setChallengeSent(true);
      toast.success("Verification code sent");
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to send verification code"
      );
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyPublicSigningAuth(token, code),
    onSuccess: () => {
      toast.success("Verified");
      onVerified();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    },
  });

  useEffect(() => {
    if (method !== "email_otp" || autoChallengeStarted.current) {
      return;
    }
    autoChallengeStarted.current = true;
    void challengePublicSigningAuth(token)
      .then(() => {
        setChallengeSent(true);
        toast.success("Verification code sent");
      })
      .catch((err: unknown) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to send verification code"
        );
      });
  }, [method, token]);

  const title =
    method === "email_otp"
      ? "Confirm your email"
      : "Enter the access code";
  const description =
    method === "email_otp"
      ? `We sent a one-time code to ${maskedEmail ?? "your email"}. Enter it to continue signing.`
      : "This envelope requires an access code from the sender before you can sign.";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <LayerCard className="w-full max-w-md p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="size-5" weight="duotone" />
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          {challengeSent || method === "access_code"
            ? description
            : "Sending a verification code…"}
        </p>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim()) {
              return;
            }
            verifyMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="signer-auth-code">
              {method === "email_otp" ? "Verification code" : "Access code"}
            </Label>
            <Input
              id="signer-auth-code"
              data-testid="signer-auth-code"
              autoComplete="one-time-code"
              inputMode={method === "email_otp" ? "numeric" : "text"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={method === "email_otp" ? "123456" : "Access code"}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              className="flex-1"
              disabled={!code.trim() || verifyMutation.isPending}
              data-testid="signer-auth-verify"
            >
              {verifyMutation.isPending ? (
                <Spinner className="size-4 animate-spin" />
              ) : (
                "Continue"
              )}
            </Button>
            {method === "email_otp" ? (
              <Button
                type="button"
                variant="outline"
                disabled={challengeMutation.isPending}
                onClick={() => challengeMutation.mutate()}
                data-testid="signer-auth-resend"
              >
                Resend code
              </Button>
            ) : null}
          </div>
        </form>
      </LayerCard>
    </div>
  );
}
