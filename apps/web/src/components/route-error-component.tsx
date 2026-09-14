import { Button, LinkButton } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import {
  ArrowClockwise,
  EnvelopeSimple,
  House,
  SignOut,
  Warning,
} from "@phosphor-icons/react";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";

import { useAnalytics } from "@/hooks/use-analytics";
import { betterAuthClient } from "@/lib/better-auth";

/**
 * Route-level error component for TanStack Router
 *
 * This component is used when a route throws an error during loading or rendering.
 * It provides options to retry, go home, or contact support.
 */
export function RouteErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const { reset: resetAnalytics } = useAnalytics();
  const isDev = import.meta.env.DEV;

  const errorMessage =
    error instanceof Error ? error.message : "An unexpected error occurred";
  const errorStack = error instanceof Error ? error.stack : undefined;

  const handleRetry = () => {
    // First reset the error boundary state
    reset();
    // Then invalidate and reload the current route
    void router.invalidate();
  };

  const handleSignOut = async () => {
    resetAnalytics();
    if (betterAuthClient === null) {
      return;
    }
    const result = await betterAuthClient.signOut();
    if (result.error) {
      console.error("Failed to sign out:", result.error);
      return;
    }
    void router.navigate({ to: "/sign-in" });
  };

  return (
    <div className="bg-kumo-base flex min-h-svh items-center justify-center p-4">
      <LayerCard className="w-full max-w-lg">
        <LayerCard.Primary className="text-center">
          <div className="bg-kumo-danger/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
            <Warning className="text-kumo-danger size-8" />
          </div>
          <Text as="h2" size="lg" variant="heading">
            Something went wrong
          </Text>
          <Text as="p" size="base" variant="secondary">
            We encountered an error while loading this page. Please try again or
            return to the home page.
          </Text>
        </LayerCard.Primary>
        <LayerCard.Primary className="space-y-4">
          <div className="bg-kumo-elevated rounded-lg p-4 text-center">
            <Text as="p" size="sm" variant="secondary">
              If the problem persists, please contact our support team for
              assistance.
            </Text>
          </div>

          {isDev && (
            <div className="border-kumo-danger/20 bg-kumo-danger/5 rounded-lg border p-4">
              <Text as="p" size="sm" variant="error">
                Error Details (Development Only):
              </Text>
              <pre className="text-kumo-secondary mt-2 overflow-auto text-xs">
                {errorMessage}
              </pre>
              {errorStack && (
                <details className="mt-2">
                  <summary className="text-kumo-secondary hover:text-kumo-default cursor-pointer text-xs">
                    Stack trace
                  </summary>
                  <pre className="text-kumo-secondary mt-2 overflow-auto text-xs">
                    {errorStack}
                  </pre>
                </details>
              )}
            </div>
          )}
        </LayerCard.Primary>
        <LayerCard.Primary className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button onClick={handleRetry} variant="primary" icon={ArrowClockwise}>
            Try Again
          </Button>
          <Button
            onClick={() => void router.navigate({ to: "/" })}
            variant="outline"
            icon={House}
          >
            Go to Home
          </Button>
          <LinkButton
            href="mailto:support@seal.nyc"
            variant="ghost"
            icon={EnvelopeSimple}
          >
            Contact Support
          </LinkButton>
          <Button
            onClick={() => void handleSignOut()}
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
