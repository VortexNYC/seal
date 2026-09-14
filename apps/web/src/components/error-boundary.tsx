import { Button } from "@cloudflare/kumo/components/button";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { ArrowClockwise, House, Warning } from "@phosphor-icons/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

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
    <div className="bg-kumo-surface flex min-h-svh items-center justify-center p-4">
      <LayerCard className="w-full max-w-lg">
        <LayerCard.Primary className="text-center">
          <div className="bg-kumo-danger/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
            <Warning className="text-kumo-danger size-8" />
          </div>
          <Text as="h2" size="lg" variant="heading">
            Something went wrong
          </Text>
          <Text as="p" size="sm" variant="secondary">
            We're sorry, but something unexpected happened. Please try again or
            return to the home page.
          </Text>
        </LayerCard.Primary>
        <LayerCard.Secondary className="space-y-3">
          {isDev && error && (
            <div className="bg-kumo-elevated rounded-lg p-4">
              <Text as="p" size="sm" variant="error" DANGEROUS_className="mb-2">
                Error Details (Development Only):
              </Text>
              <pre className="text-kumo-secondary overflow-auto text-xs">
                {error.message}
              </pre>
              {error.stack && (
                <details className="mt-2">
                  <summary className="text-kumo-secondary hover:text-kumo-primary cursor-pointer text-xs">
                    Stack trace
                  </summary>
                  <pre className="text-kumo-secondary mt-2 overflow-auto text-xs">
                    {error.stack}
                  </pre>
                </details>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={onReset}
              className="w-full sm:w-auto"
              icon={ArrowClockwise}
            >
              Try Again
            </Button>
            <Button
              onClick={onGoHome}
              variant="outline"
              className="w-full sm:w-auto"
              icon={House}
            >
              Go to Home
            </Button>
          </div>
        </LayerCard.Secondary>
      </LayerCard>
    </div>
  );
}
