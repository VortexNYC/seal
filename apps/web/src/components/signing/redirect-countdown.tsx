import { ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

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

  const buildFinalUrl = () => {
    try {
      const url = new URL(redirectUrl);
      url.searchParams.set("recipientEmail", recipientEmail);
      url.searchParams.set("recipientName", recipientName);
      url.searchParams.set("status", "signed");
      return url.toString();
    } catch {
      return redirectUrl;
    }
  };

  useEffect(() => {
    if (cancelled || secondsLeft <= 0) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelled]);

  const handleGoNow = () => {
    window.location.href = buildFinalUrl();
  };

  const handleStayHere = () => {
    setCancelled(true);
    onStayHere();
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <ExternalLinkIcon className="h-4 w-4" />
        <span>
          You will be redirected to{" "}
          <span className="text-foreground font-medium">{destination}</span> in{" "}
          <span className="text-foreground font-medium tabular-nums">{secondsLeft}</span>{" "}
          {secondsLeft === 1 ? "second" : "seconds"}...
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGoNow}
          className="text-primary text-sm font-medium underline underline-offset-4 hover:no-underline"
        >
          Go now
        </button>
        <span className="text-muted-foreground/40">·</span>
        <Button variant="outline" size="sm" onClick={handleStayHere}>
          Stay here
        </Button>
      </div>
    </div>
  );
}
