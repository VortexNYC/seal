import { Banner } from "@cloudflare/kumo/components/banner";
import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import {
  ArrowBendUpLeft,
  ArrowClockwise,
  House,
  SignOut,
  WarningCircle,
} from "@phosphor-icons/react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { betterAuthClient } from "@/lib/better-auth";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });

  console.error(error);

  const errorMessage =
    error instanceof Error ? error.message : "An unexpected error occurred";
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Focus management: move focus to the error card when it appears
  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.focus();
    }
  }, []);

  return (
    <div
      className="flex min-h-dvh items-center justify-center p-4 sm:p-6 lg:p-8"
      role="alert"
      aria-live="assertive"
    >
      <LayerCard
        ref={cardRef}
        tabIndex={-1}
        className="w-full max-w-2xl focus:outline-none"
      >
        <LayerCard.Primary className="text-center">
          <div className="bg-kumo-danger/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <WarningCircle className="text-kumo-danger h-6 w-6" />
          </div>
          <Text as="h2" size="lg" variant="heading">
            Something went wrong
          </Text>
          <Text size="sm" variant="secondary">
            We encountered an error while processing your request
          </Text>
        </LayerCard.Primary>

        <LayerCard.Primary className="space-y-4">
          <Banner
            variant="error"
            icon={<WarningCircle className="h-5 w-5" />}
            title="Error Details"
            description={errorMessage}
          />

          {errorStack && import.meta.env.DEV && (
            <details className="border-kumo-hairline rounded-lg border p-4">
              <summary className="text-kumo-secondary hover:text-kumo-default cursor-pointer text-sm font-medium">
                View stack trace (development only)
              </summary>
              <pre className="text-kumo-secondary mt-2 overflow-x-auto text-xs">
                {errorStack}
              </pre>
            </details>
          )}
        </LayerCard.Primary>

        <LayerCard.Primary className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            onClick={() => router.invalidate()}
            variant="primary"
            icon={ArrowClockwise}
          >
            Try Again
          </Button>

          {isRoot ? (
            <Button
              onClick={() => void router.navigate({ to: "/" })}
              variant="outline"
              icon={House}
            >
              Go Home
            </Button>
          ) : (
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              icon={ArrowBendUpLeft}
            >
              Go Back
            </Button>
          )}

          <Button
            onClick={async () => {
              if (betterAuthClient === null) return;
              const result = await betterAuthClient.signOut();
              if (result.error) {
                console.error("Failed to sign out:", result.error);
                return;
              }
              void router.navigate({ to: "/sign-in" });
            }}
            variant="ghost"
            icon={SignOut}
          >
            Sign Out
          </Button>
        </LayerCard.Primary>
      </LayerCard>
    </div>
  );
}
