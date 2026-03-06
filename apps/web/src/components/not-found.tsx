import { Link, useRouter } from "@tanstack/react-router";
import { FileQuestion, Home, RefreshCw, Undo2 } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <Card ref={cardRef} tabIndex={-1} className="w-full max-w-2xl focus:outline-none">
        <CardHeader className="text-center">
          <div className="bg-muted mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <FileQuestion className="text-muted-foreground h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">404 - Page Not Found</CardTitle>
          <CardDescription>
            {children || "The page you are looking for does not exist."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-muted-foreground text-center text-sm">
            The page may have been moved, deleted, or the URL might be incorrect.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => router.invalidate()}
            variant="default"
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
