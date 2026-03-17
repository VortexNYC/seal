import { useClerk } from "@clerk/clerk-react";
import * as Sentry from "@sentry/react";
import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router";
import { AlertTriangleIcon, HomeIcon, LogOut, MailIcon, RefreshCwIcon } from "lucide-react";
import { useEffect } from "react";

import { useAnalytics } from "@/hooks/use-analytics";

import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";

/**
 * Route-level error component for TanStack Router
 *
 * This component is used when a route throws an error during loading or rendering.
 * It provides options to retry, go home, or contact support.
 */
export function RouteErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { reset: resetAnalytics } = useAnalytics();
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "route-error" },
    });
  }, [error]);

  const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
  const errorStack = error instanceof Error ? error.stack : undefined;

  const handleRetry = () => {
    // First reset the error boundary state
    reset();
    // Then invalidate and reload the current route
    router.invalidate();
  };

  const handleSignOut = async () => {
    resetAnalytics();
    await signOut();
  };

  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
            <AlertTriangleIcon className="text-destructive size-8" />
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
          <CardDescription className="text-base">
            We encountered an error while loading this page. Please try again or return to the home
            page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-muted-foreground text-sm">
              If the problem persists, please contact our support team for assistance.
            </p>
          </div>

          {isDev && (
            <div className="border-destructive/20 bg-destructive/5 rounded-lg border p-4">
              <p className="text-destructive mb-2 text-sm font-medium">
                Error Details (Development Only):
              </p>
              <pre className="text-muted-foreground overflow-auto text-xs">{errorMessage}</pre>
              {errorStack && (
                <details className="mt-2">
                  <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                    Stack trace
                  </summary>
                  <pre className="text-muted-foreground mt-2 overflow-auto text-xs">
                    {errorStack}
                  </pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={handleRetry} variant="default" className="w-full sm:w-auto">
            <RefreshCwIcon className="size-4" />
            Try Again
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/">
              <HomeIcon className="size-4" />
              Go to Home
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full sm:w-auto">
            <a href="mailto:support@seal.nyc">
              <MailIcon className="size-4" />
              Contact Support
            </a>
          </Button>
          <Button onClick={() => void handleSignOut()} variant="ghost" className="w-full sm:w-auto">
            <LogOut className="size-4" />
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
