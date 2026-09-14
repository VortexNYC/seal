import { Button } from "@cloudflare/kumo/components/button";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

interface RedirectCountdownProps {
  redirectUrl: string;
  recipientEmail: string;
  recipientName: string;
  onStayHere: () => void;
}

export function RedirectCountdown({
  redirectUrl,
  recipientEmail,
  recipientName,
  onStayHere,
}: RedirectCountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [cancelled, setCancelled] = useState(false);

  const destination = (() => {
    try {
      return new URL(redirectUrl).hostname;
    } catch {
      return redirectUrl;
    }
  })();

  const buildFinalUrl = useCallback(() => {
    try {
      const url = new URL(redirectUrl);
      url.searchParams.set("recipientEmail", recipientEmail);
      url.searchParams.set("recipientName", recipientName);
      url.searchParams.set("status", "signed");
      return url.toString();
    } catch {
      return redirectUrl;
    }
  }, [recipientEmail, recipientName, redirectUrl]);

  useEffect(() => {
    if (cancelled || secondsLeft <= 0) return undefined;

    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          window.location.href = buildFinalUrl();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [buildFinalUrl, cancelled, secondsLeft]);

  const handleGoNow = () => {
    window.location.href = buildFinalUrl();
  };

  const handleStayHere = () => {
    setCancelled(true);
    onStayHere();
  };

  return (
    <div className="border-kumo-info-tint bg-kumo-info-tint/30 flex flex-col items-center gap-4 rounded-xl border p-4 text-center">
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          <span className="bg-kumo-info/20 absolute inset-0 animate-ping rounded-full" />
          <ArrowSquareOut className="text-kumo-info relative h-4 w-4" />
        </div>
        <span className="text-kumo-secondary text-sm">
          Redirecting to{" "}
          <span className="text-kumo-primary font-medium">{destination}</span>{" "}
          in{" "}
          <span className="text-kumo-primary font-semibold tabular-nums">
            {secondsLeft}s
          </span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={handleGoNow}
          disabled={secondsLeft === 0}
        >
          <ArrowSquareOut className="mr-1.5 h-3.5 w-3.5" />
          Go now
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-kumo-secondary"
          onClick={handleStayHere}
        >
          Stay here
        </Button>
      </div>
    </div>
  );
}
