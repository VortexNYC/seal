import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router";
import { AlertCircle, Home, LogOut, RefreshCw, Undo2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppAuthActions } from "@/lib/auth-runtime.better-auth";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const { signOut } = useAppAuthActions();
  const cardRef = useRef<HTMLDivElement>(null);
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  });

  console.error(error);

  const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
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
      <Card ref={cardRef} tabIndex={-1} className="w-full max-w-2xl focus:outline-none">
        <CardHeader className="text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <AlertCircle className="text-destructive h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
          <CardDescription>We encountered an error while processing your request</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Details</AlertTitle>
            <AlertDescription className="mt-2 font-mono text-xs">{errorMessage}</AlertDescription>
          </Alert>

          {errorStack && import.meta.env.DEV && (
            <details className="rounded-lg border p-4">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium">
                View stack trace (development only)
              </summary>
              <pre className="text-muted-foreground mt-2 overflow-x-auto text-xs">{errorStack}</pre>
            </details>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            onClick={() => router.invalidate()}
            className="w-full sm:w-auto"
            variant="default"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>

          {isRoot ? (
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto"
              onClick={(e) => {
                e.preventDefault();
                window.history.back();
              }}
            >
              <Link to="/">
                <Undo2 className="mr-2 h-4 w-4" />
                Go Back
              </Link>
            </Button>
          )}

          <Button
            onClick={() => void signOut({ redirectUrl: "/sign-in" })}
            className="w-full sm:w-auto"
            variant="ghost"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
