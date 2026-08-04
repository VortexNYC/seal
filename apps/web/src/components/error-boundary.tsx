import { AlertTriangleIcon, HomeIcon, RefreshCwIcon } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary component that catches JavaScript errors anywhere
 * in the child component tree, logs errors, and displays a fallback UI.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    console.error("ErrorBoundary caught an error:", error);
    console.error("Error info:", errorInfo);

    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = (): void => {
    window.location.href = "/";
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
  onGoHome: () => void;
}

/**
 * Default error fallback UI component
 */
export function ErrorFallback({
  error,
  onReset,
  onGoHome,
}: ErrorFallbackProps) {
  const isDev = import.meta.env.DEV;

  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="bg-destructive/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
            <AlertTriangleIcon className="text-destructive size-8" />
          </div>
          <CardTitle className="text-2xl">Something went wrong</CardTitle>
          <CardDescription className="text-base">
            We're sorry, but something unexpected happened. Please try again or
            return to the home page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDev && error && (
            <div className="bg-muted rounded-lg p-4">
              <p className="text-destructive mb-2 text-sm font-medium">
                Error Details (Development Only):
              </p>
              <pre className="text-muted-foreground overflow-auto text-xs">
                {error.message}
              </pre>
              {error.stack && (
                <details className="mt-2">
                  <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                    Stack trace
                  </summary>
                  <pre className="text-muted-foreground mt-2 overflow-auto text-xs">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={onReset}
            variant="default"
            className="w-full sm:w-auto"
          >
            <RefreshCwIcon className="size-4" />
            Try Again
          </Button>
          <Button
            onClick={onGoHome}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <HomeIcon className="size-4" />
            Go to Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
