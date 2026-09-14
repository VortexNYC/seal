import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import {
  ArrowBendUpLeft,
  ArrowClockwise,
  House,
  Question,
} from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";

export function NotFound({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus management: move focus to the card when it appears
  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.focus();
    }
  }, []);

  return (
    <div
      className="flex min-h-dvh items-center justify-center p-4 sm:p-6 lg:p-8"
      role="alert"
      aria-live="polite"
    >
      <LayerCard
        ref={cardRef}
        tabIndex={-1}
        className="w-full max-w-2xl focus:outline-none"
      >
        <LayerCard.Primary className="text-center">
          <div className="bg-kumo-elevated mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Question className="text-kumo-secondary h-6 w-6" />
          </div>
          <Text as="h2" size="lg" variant="heading">
            404 - Page Not Found
          </Text>
          <Text size="sm" variant="secondary">
            {children || "The page you are looking for does not exist."}
          </Text>
        </LayerCard.Primary>

        <LayerCard.Primary className="text-center">
          <p className="text-kumo-secondary text-sm">
            The page may have been moved, deleted, or the URL might be
            incorrect.
          </p>
        </LayerCard.Primary>

        <LayerCard.Primary className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={() => router.invalidate()}
            variant="primary"
            icon={ArrowClockwise}
          >
            Try Again
          </Button>
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            icon={ArrowBendUpLeft}
          >
            Go Back
          </Button>
          <Button
            onClick={() => void router.navigate({ to: "/" })}
            variant="outline"
            icon={House}
          >
            Go Home
          </Button>
        </LayerCard.Primary>
      </LayerCard>
    </div>
  );
}
